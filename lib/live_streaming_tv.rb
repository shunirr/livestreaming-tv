require 'active_record'

module LiveStreamingTV
  module Model
    autoload :Channel, 'live_streaming_tv/models/channels'
    autoload :Programme, 'live_streaming_tv/models/programmes'
    autoload :Ch2, 'live_streaming_tv/models/ch2s'
  end
  autoload :Controller, 'live_streaming_tv/controller'
  autoload :BonDriverController, 'live_streaming_tv/bon_driver_controller'
  autoload :FFmpeg, 'live_streaming_tv/ffmpeg'
end
