# Windows 

require 'open3'
require 'json'
require 'sinatra'
require 'twitter'
require 'tempfile'

RECTEST_URL     = 'udp://127.0.0.1:3456'
FFMPEG_PATH     = 'C:/tv/ffmpeg/bin/ffmpeg.exe'
EPGDUMP_PATH    = 'C:/tv/epgdump/epgdump.exe'
BONDRIVER_PATH  = 'C:/tv/TVTest/BonDriver_Spinel_PT-T0.dll'
BONDRIVER_CONTROLLER_PATH = 'C:/tv/TVTest/BonDriverController.exe'

TS_FPS           = 24
HLS_SEGMENT_TIME = 2

module LiveStreamingTV
  class BonDriverController
    def self.channel(ch = nil)
      if ch.nil?
        Open3.capture2e(BONDRIVER_CONTROLLER_PATH, BONDRIVER_PATH)[0].split(' ').map{|s| s.to_i}
      else
        Open3.capture2e(BONDRIVER_CONTROLLER_PATH, BONDRIVER_PATH, '0', ch.to_s)[0]
      end
    end
  end

  class FFmpeg
    def initialize
      @pid = 0
    end

    def stop
      return if @pid <= 0
      Process.kill('KILL', @pid)
      @pid = 0
    end

    def start
      return if @pid > 0

      Thread.start do
        loop do
          puts "start ffmpeg"
          Open3.popen2e(FFMPEG_PATH,
                        '-i', "#{RECTEST_URL}?pkt_size=262144^&fifo_size=1000000^&overrun_nonfatal=1",
                        '-threads', 'auto',
                        '-map', '0:0', '-map', '0:1',
                        '-acodec', 'libfdk_aac', '-ar', '44100', '-ab', '128k', '-ac', '2',
                        # '-vcodec', 'libx264', '-s', '1280x720', '-aspect', '16:9', '-vb', '1m',
                        '-vcodec', 'libx264', '-s', '800x450', '-aspect', '16:9', '-vb', '1m',
                        # '-vcodec', 'libx264', '-s', '640x360', '-aspect', '16:9', '-vb', '500k',
                        '-vsync', '1', '-async', '50',
                        '-r', "#{TS_FPS}",
                        '-g', "#{TS_FPS}",
                        '-force_key_frames', "expr:gte(t,n_forced*#{HLS_SEGMENT_TIME})",
                        '-f', 'flv',
                        'rtmp://127.0.0.1:1935/hls/stream') do |i, o, w|
                          @pid = w.pid
                          o.each do |l|
                            puts l
                            stop if l.include? 'New audio stream'
                            if l.include? 'speed='
                              l.match /speed=([0-9.]+)x/ do |md|
                                speed = md[1].to_f
                                stop if speed < 0.8
                              end
                            end
                          end
                        end
          @pid = 0
        end
      end
    end
  end

  class Controller < Sinatra::Base
    configure do
      set :ffmpeg, FFmpeg.new
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

    get '/current_channel.json' do
      content_type :json
      BonDriverController.channel.to_json
    end

    post '/select_channel' do
      ch = params[:ch].to_i
      BonDriverController.channel(ch)
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

