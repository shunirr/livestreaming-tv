require 'active_record'

module LiveStreamingTV
  module Model
    autoload :Channel, 'live_streaming_tv/models/channels'
    autoload :Programme, 'live_streaming_tv/models/programmes'
  end
end
