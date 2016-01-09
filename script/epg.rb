$:.unshift '../lib', './lib'

require 'rexml/document'
require 'date'
require 'yaml'

require 'live_streaming_tv'

if ARGV.size != 1
  puts "Usage: #{$0} epgdump.xml"
  exit
end

config = YAML.load(File.open('config/database.yaml'))
ActiveRecord::Base.establish_connection(config)

doc = REXML::Document.new(open(ARGV.shift))

doc.elements.each('tv/channel') do |channel|
  ch = LiveStreamingTV::Model::Channel.find_or_initialize_by(
    channel_id: channel.attributes['id']
  )
  ch.tp = channel.attributes['tp'].to_i
  ch.display_name = channel.elements['display-name'].text
  ch.transport_stream_id = channel.elements['transport_stream_id'].text.to_i
  ch.original_network_id = channel.elements['original_network_id'].text.to_i
  ch.service_id = channel.elements['service_id'].text.to_i
  ch.save
end

doc.elements.each('tv/programme') do |programme|
  pr = LiveStreamingTV::Model::Programme.find_or_initialize_by(
    event_id: programme.attributes['event_id'].to_i
  )
  pr.start = DateTime.parse programme.attributes['start']
  pr.stop = DateTime.parse programme.attributes['stop']
  pr.channel = programme.attributes['channel']
  pr.title = programme.elements['title'].text
  pr.desc = programme.elements['desc'].text
  pr.category = programme.elements['category'].text
  pr.save
end

