require 'open3'

module LiveStreamingTV
  attr_accessor :thread
  class FFmpeg
    def initialize(config)
      @pid = 0
      @config = config
    end

    def stop
      return if @pid <= 0
      Process.kill('KILL', @pid)
      @pid = 0
    end

    def start
      return if @pid > 0

      @thread = Thread.start do
        loop do
          puts "start ffmpeg"
          Open3.popen2e(@config['ffmpeg_path'],
                        '-i', "#{@config['rectest_url']}?pkt_size=262144^&fifo_size=1000000^&overrun_nonfatal=1",
                        '-threads', 'auto',
                        '-map', '0:0', '-map', '0:1',
                        '-acodec', 'libfdk_aac', '-ar', '44100', '-ab', '128k', '-ac', '2',
                        '-vcodec', 'libx264', '-s', @config['ffmpeg']['s'], '-aspect', '16:9', '-vb', @config['ffmpeg']['vb'],
                        '-vsync', '1', '-async', '50',
                        '-r', @config['ffmpeg']['r'],
                        '-g', @config['ffmpeg']['r'],
                        '-force_key_frames', "expr:gte(t,n_forced*#{@config['ffmpeg']['hls_segment_time']})",
                        '-f', 'flv',
                        @config['rtmp_url']) do |i, o, w|
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
          puts "dead ffmpeg"
          @pid = 0
        end
      end
    end
  end
end

