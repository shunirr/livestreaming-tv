# Windows 

require 'open3'
require 'time'
require 'sinatra'
require 'm3u8'
require 'twitter'
require 'tempfile'

RECTEST_PATH    = 'C:/tv/TVTest/RecTest.exe'
RECTEST_PORT    = 3456
FFMPEG_PATH     = 'C:/tv/ffmpeg/bin/ffmpeg.exe'
HLS_PATH        = 'public/hls'
M3U8_FILENAME   = 'playlist.m3u8'

TS_FPS           = 24
HLS_SEGMENT_TIME = 2

module LiveStreamingTV
  class RecTest
    def initialize
      @pid = 0
      @ch = 0
    end

    def restart(ch = 0)
      @ch = ch
      stop
    end

    def stop
      if @pid > 0
        Process.kill('KILL', @pid)
        @pid = 0
      end
    end

    def start(ch = 0)
      return if @pid > 0
      @ch = ch if ch > 0

      Thread.start do 
        puts "start rectest (ch = #{@ch})"
	loop {
          if @ch > 0
            Open3.popen3(RECTEST_PATH, '/rch', @ch.to_s, '/udp', '/udpport', RECTEST_PORT.to_s) do |i, o, e, w|
              @pid = w.pid
            end
          else
            Open3.popen3(RECTEST_PATH, '/udp', '/udpport', RECTEST_PORT.to_s) do |i, o, e, w|
              @pid = w.pid
            end
          end
          @pid = 0
	}
      end
    end

    def running?
      @pid > 0
    end
  end

  class FFmpeg
    def initialize
      @pid = 0
    end

    def restart
      stop
    end

    def stop
      if @pid > 0
        Process.kill('KILL', @pid)
        @pid = 0
      end
    end

    def start
      return if @pid > 0

      Thread.start do
        loop {
          puts "start ffmpeg"
          delete_temp_files
          now = Time.now.to_i
          Open3.popen3(FFMPEG_PATH,
                       '-i', "udp://127.0.0.1:#{RECTEST_PORT}?pkt_size=262144^&fifo_size=1000000^&overrun_nonfatal=1",
                       '-f', 'mpegts',
                       '-threads', 'auto',
                       '-map', '0:0', '-map', '0:1',
                       '-acodec', 'libvo_aacenc', '-ar', '44100', '-ab', '128k', '-ac', '2',
                       '-vcodec', 'libx264', '-s', '1280x720', '-aspect', '16:9', '-vb', '1m',
                       '-r', TS_FPS.to_s,
                       '-g', "#{TS_FPS}",
                       '-force_key_frames', "expr:(t/#{HLS_SEGMENT_TIME})",
                       '-f', 'segment',
                       '-segment_format', 'mpegts',
                       '-segment_time', HLS_SEGMENT_TIME.to_s,
                       '-segment_list', "#{HLS_PATH}/#{now}_#{M3U8_FILENAME}",
                       '-segment_list_flags', 'live',
                       '-segment_wrap', '50',
                       '-segment_list_size', '5',
                       '-break_non_keyframes', '1',
                       "#{HLS_PATH}/#{now}_stream%d.ts") do |i, o, e, w|
                         puts "ffmpeg is running (pid = #{w.pid})"
                         @pid = w.pid
                         e.each {|l| puts l}
                       end
          puts "ffmpeg is dead"
          @pid = 0
        }
      end
    end

    def delete_temp_files
      playlists = Dir.glob("#{HLS_PATH}/*.m3u8").sort do |a, b|
        File.basename(a) <=> File.basename(b)
      end
      if playlists.size > 1
        prefix = File.basename(playlists[0]).match(/^\d+/)[0]
        File.delete playlists[0]
        Dir.glob("#{HLS_PATH}/#{prefix}_*.ts").each do |f|
          File.delete f
        end
      end
    end

    def running?
      @pid > 0
    end
  end

  class Controller < Sinatra::Base
    configure do
      set :rectest, RecTest.new
      set :ffmpeg, FFmpeg.new
      set :sequence, Hash.new
      settings.rectest.start
      settings.ffmpeg.start

      client = Twitter::REST::Client.new do |config|
        config.consumer_key        = ENV['CONSUMER_KEY']
        config.consumer_secret     = ENV['CONSUMER_SECRET']
        config.access_token        = ENV['ACCESS_TOKEN']
        config.access_token_secret = ENV['ACCESS_TOKEN_SECRET']
      end
      set :twitter_client, client
    end

    get '/' do
      File.read(File.join('public', 'index.html'))
    end

    get '/hls/playlist.m3u8' do
      playlists = []

      Dir.glob("#{HLS_PATH}/*.m3u8").sort do |a, b|
        # File.basename(a) <=> File.basename(b)
        File.basename(b) <=> File.basename(a)
      end.each do |file|
        time = File.basename(file).match(/^\d+/)[0].to_i
	begin
          File.open(file) do |f|
            m3u8 = M3u8::Playlist.read(f.read)
	    settings.sequence[File.basename(file)] = m3u8.sequence
            playlists << {:time => time, :m3u8 => m3u8}
	  end
	rescue
	  sleep 0.1
	  retry
	end
      end
        
      seq = settings.sequence.values.inject {|sum, n| sum + n}

      if playlists.size == 0
        404
      # elsif playlists.size == 1
      else
	playlists[0][:m3u8].sequence = seq 
	playlists[0][:m3u8].target = HLS_SEGMENT_TIME 
	playlists[0][:m3u8].to_s.gsub('#EXT-X-ENDLIST', '')
      # else
      #   playlists[0][:m3u8].items.shift([playlists[0][:m3u8].items.size, playlists[1][:m3u8].items.size].min)
      #   playlists[0][:m3u8].items.concat(playlists[1][:m3u8].items)
      #   playlists[0][:m3u8].sequence = seq
      #   playlists[0][:m3u8].target = HLS_SEGMENT_TIME 
      #   playlists[0][:m3u8].to_s.gsub('#EXT-X-ENDLIST', '')
      end
    end

    get '/hls/*.ts' do |filename|
      file = File.join('public', "#{filename}.ts")
      if File.exist? file
        File.read(file)
      else
	404
      end
    end

    post '/select_channel' do
      ch = params[:ch].to_i
      puts "select ch = #{ch}"
      settings.rectest.restart ch
      settings.ffmpeg.restart
      200
    end

    post '/tweet' do
      img = params[:url].sub(/^data:image\/png;base64,/, '').unpack('m').first
      Tempfile.create("#{rand(256**16).to_s(16)}.png") do |png|
        open(png, 'wb') {|f| f.write img }
	open(png) do |f|
          settings.twitter_client.update_with_media(' ', f)
	end
      end
      201
    end
  end
end
