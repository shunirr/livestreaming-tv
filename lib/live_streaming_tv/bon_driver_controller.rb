require 'open3'

module LiveStreamingTV
  class BonDriverController
    def initialize(config)
      @config = config
    end

    def channel(ch = nil)
      if ch.nil?
        Open3.capture2e(@config['bondriver_controller_path'], @config['bondriver_path'])[0].split(' ').map{|s| s.to_i}
      else
        Open3.capture2e(@config['bondriver_controller_path'], @config['bondriver_path'], '0', ch.to_s)[0]
      end
    end
  end
end

