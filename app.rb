# Windows 

require 'open3'
require 'sinatra'

RECTEST_COMMAND = 'RecTest.exe'
RECTEST_PATH    = 'C:\\tv\\TVTest'
RECTEST_PORT    = 3456
FFMPEG_COMMAND  = 'ffmpeg.exe'
FFMPEG_PATH     = 'C:\\tv\\ffmpeg\\bin'
WWW_PATH        = 'public\\hls'
M3U8_FILENAME   = 'playlist.m3u8'

TS_FPS           = 24
HLS_SEGMENT_TIME = 2

$channel_id = nil
$ffmpeg_thread = nil

def stop_rectest
  system('TASKKILL', '/im', RECTEST_COMMAND, '/F', '/T')
end

def stop_ffmpeg
  system('TASKKILL', '/im', FFMPEG_COMMAND, '/F', '/T')
end

def start_rectest
  puts "start_rectest ch = #{$channel_id}"
  if $channel_id.nil?
    system('start', "#{RECTEST_PATH}\\#{RECTEST_COMMAND}", '/udp', '/udpport', RECTEST_PORT.to_s)
  else
    system('start', "#{RECTEST_PATH}\\#{RECTEST_COMMAND}", '/rch', $channel_id.to_s, '/udp', '/udpport', RECTEST_PORT.to_s)
  end
end

def start_ffmpeg
  puts "start_ffmpeg"
  $ffmpeg_thread = Thread.new do
    loop do
      Dir.glob("#{WWW_PATH}\\*.ts".gsub('\\', '//')).each do |f|
        File.delete f
      end
      Open3.popen3("#{FFMPEG_PATH}\\#{FFMPEG_COMMAND}",
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
                   '-segment_list', "#{WWW_PATH}\\#{M3U8_FILENAME}",
                   '-segment_list_flags', 'live',
                   '-segment_wrap', '50',
                   '-segment_list_size', '5',
                   '-break_non_keyframes', '1',
                   "#{WWW_PATH}\\stream%d.ts") do |i, o, e, w|
      end
    end
  end
end

def delete_all
  m3u8 = "#{WWW_PATH}\\playlist.m3u8"
  File.delete m3u8 if File.exist? m3u8
  Dir.glob("#{WWW_PATH}\\*.ts".gsub('\\', '//')).each do |f|
    File.delete f
  end
end

def restart_all
  puts "restart_all"
  stop_rectest
  stop_ffmpeg
  start_rectest
  start_ffmpeg if $ffmpeg_thread.nil?
end

### 

delete_all
restart_all

get '/' do
  File.read(File.join('public', 'index.html'))
end

post '/select_channel' do
  begin
    ch = params['ch'].to_i
    if $channel_id != ch
      puts "select ch = #{ch}"
      $channel_id = ch
      restart_all
    end
  rescue
  end
  200
end

