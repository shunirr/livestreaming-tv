#!/usr/bin/env ruby
# -*- encoding: utf-8 -*-

$:.unshift './lib'

require 'live_streaming_tv'

use Rack::Static, urls: ['/js'], root: 'public'
run LiveStreamingTV::Controller
