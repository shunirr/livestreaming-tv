# Windows 

require 'open3'
require 'sinatra'

RECTEST_PATH    = 'C:/tv/TVTest/RecTest.exe'
RECTEST_PORT    = 3456
FFMPEG_PATH     = 'C:/tv/ffmpeg/bin/ffmpeg.exe'
WWW_PATH        = 'public/hls'
M3U8_FILENAME   = 'playlist.m3u8'

TS_FPS           = 24
HLS_SEGMENT_TIME = 2

module LiveStreamingTV
  class RecTest
    def initialize
      @pid = 0
    end

    def restart(ch = 0)
      stop
      start ch
    end

    def stop
      if @pid > 0
        Process.kill('KILL', @pid)
        @pid = 0
      end
    end

    def start(ch = 0)
      return if @pid > 0

      Thread.start do 
        puts "start rectest (ch = #{ch})"
        if ch > 0
          Open3.popen3(RECTEST_PATH, '/rch', ch.to_s, '/udp', '/udpport', RECTEST_PORT.to_s) do |i, o, e, w|
            @pid = w.pid
          end
        else
          Open3.popen3(RECTEST_PATH, '/udp', '/udpport', RECTEST_PORT.to_s) do |i, o, e, w|
            @pid = w.pid
          end
        end
        @pid = 0
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
      start
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
        puts "start ffmpeg"
        delete_temp_files
        Open3.popen3(FFMPEG_PATH,
                     '-i', "udp://127.0.0.1:#{RECTEST_PORT}?pkt_size=262144^&fifo_size=1000000^&overrun_nonfatal=1",
                     '-f', 'mpegts',
                     '-threads', 'auto',
                     '-map', '0:0', '-map', '0:1',
                     '-acodec', 'libvo_aacenc', '-ar', '44100', '-ab', '128k', '-ac', '2',
                     '-vcodec', 'libx264', '-s', '1280x720', '-aspect', '16:9', '-vb', '2m',
                     '-r', TS_FPS.to_s,
                     '-g', "#{TS_FPS * HLS_SEGMENT_TIME}",
                     '-force_key_frames', "expr:(t/#{HLS_SEGMENT_TIME})",
                     '-f', 'segment',
                     '-segment_format', 'mpegts',
                     '-segment_time', HLS_SEGMENT_TIME.to_s,
                     '-segment_list', "#{WWW_PATH}/#{M3U8_FILENAME}",
                     '-segment_list_flags', 'live',
                     '-segment_wrap', '50',
                     '-segment_list_size', '5',
                     '-break_non_keyframes', '1',
                     "#{WWW_PATH}/stream%d.ts") do |i, o, e, w|
                       puts "ffmpeg is running (pid = #{w.pid})"
                       @pid = w.pid
                       e.each {|l| puts l}
                     end
        puts "ffmpeg is dead"
        @pid = 0
      end
    end

    def delete_temp_files
      m3u8 = "#{WWW_PATH}/#{M3U8_FILENAME}"
      File.delete m3u8 if File.exist? m3u8
      Dir.glob("#{WWW_PATH}/*.ts").each do |f|
        File.delete f
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
      settings.rectest.start
      settings.ffmpeg.start
    end

    get '/' do
      settings.rectest.start unless settings.rectest.running?
      settings.ffmpeg.start unless settings.ffmpeg.running?
      File.read(File.join('public', 'index.html'))
    end

    post '/select_channel' do
      ch = params['ch'].to_i
      puts "select ch = #{ch}"
      settings.rectest.restart ch
      settings.ffmpeg.restart
      200
    end
  end
end
