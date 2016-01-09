$:.unshift '../lib', './lib'

require 'yaml'

require 'live_streaming_tv'

if ARGV.size != 1
  puts "Usage: #{$0} BonDriver_XXX.ch2"
  exit
end

config = YAML.load(File.open('config/database.yaml'))
ActiveRecord::Base.establish_connection(config)

raw = open(ARGV.shift).read
raw.encode!('UTF-8', 'Shift_JIS') unless raw.valid_encoding?

raw.split("\n").each do |line|
  next if line.start_with? ';'
  data = line.split(',')
  ch2 = LiveStreamingTV::Model::Ch2.find_or_initialize_by(
    service_id: data[5].to_i
  )
  ch2.name = data[0]
  ch2.tuning_space = data[1].to_i
  ch2.remocon_number = data[2].to_i
  ch2.channel_number = data[3].to_i
  ch2.network_id = data[6].to_i
  ch2.tsid = data[7].to_i
  ch2.status = data[8].to_i
  ch2.save
end
