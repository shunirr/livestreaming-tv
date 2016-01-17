$:.unshift './lib'

require 'live_streaming_tv'
require 'yaml'

config = YAML.load(open('config/config.yaml'))
ffmpeg = LiveStreamingTV::FFmpeg.new(config)
ffmpeg.start
ffmpeg.thread.join
