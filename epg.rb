require 'rexml/document'
require 'date'

if ARGV.size != 1
  exit 1
end

doc = REXML::Document.new(open(ARGV.shift))

class Channel
  attr_accessor :id, :tp, :display_name, :transport_stream_id, :original_network_id, :service_id
end

class Programme
  attr_accessor :start, :stop, :channel, :event_id, :title, :desc, :category
end

channels = []
doc.elements.each('tv/channel') do |channel|
  ch = Channel.new
  ch.id = channel.attributes['id']
  ch.tp = channel.attributes['tp'].to_i
  ch.display_name = channel.elements['display-name'].text
  ch.transport_stream_id = channel.elements['transport_stream_id'].text.to_i
  ch.original_network_id = channel.elements['original_network_id'].text.to_i
  ch.service_id = channel.elements['service_id'].text.to_i
  channels << ch
end

programmes = []
doc.elements.each('tv/programme') do |programme|
  pr = Programme.new
  pr.start = DateTime.parse programme.attributes['start']
  pr.stop = DateTime.parse programme.attributes['stop']
  pr.channel = programme.attributes['channel']
  pr.event_id = programme.attributes['event_id'].to_i
  pr.title = programme.elements['title'].text
  pr.desc = programme.elements['desc'].text
  pr.category = programme.elements['category'].text
  programmes << pr
end

