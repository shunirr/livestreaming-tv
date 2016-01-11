#!/usr/bin/env ruby

$:.unshift '../lib', './lib'

require 'rexml/document'
require 'date'
require 'yaml'
require 'live_streaming_tv'

BONDRIVER_PATH = 'C:/tv/TVTest/BonDriver_Spinel_PT-T1.dll'
RECTEST_PATH = 'C:/tv/TVTest/RecTest.exe'
RECTEST_RECORD_PATH = 'C:/tv/data/'
EPGDUMP_PATH = 'C:/tv/epgdump/epgdump.exe'

config = YAML.load(File.open('config/database.yaml'))
ActiveRecord::Base.establish_connection(config)

def import_epg(doc)
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
end

Dir.glob(File.join(RECTEST_RECORD_PATH, "*.ts")) do |file|
  File.delete file
end
Dir.glob(File.join(RECTEST_RECORD_PATH, "*.xml")) do |file|
  File.delete file
end

LiveStreamingTV::Model::Ch2.all.each do |ch2|
  ts  = File.join(RECTEST_RECORD_PATH,
                  "#{ch2.tuning_space}-#{ch2.remocon_number}.ts")
  xml = File.join(RECTEST_RECORD_PATH,
                  "#{ch2.tuning_space}-#{ch2.remocon_number}.xml")
  system(RECTEST_PATH,
         '/d', BONDRIVER_PATH,
	 '/chspace', "#{ch2.tuning_space}",
         '/rch', "#{ch2.channel_number}",
	 '/rec', 
	 '/recduration', '10',
	 '/recexit',
	 '/recfile', ts)
  system(EPGDUMP_PATH, "#{ch2.channel_number}", ts, xml)
  import_epg(REXML::Document.new(open(xml)))
end

