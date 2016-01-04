#!/usr/bin/env ruby
# -*- encoding: utf-8 -*-

require './app'

use Rack::Static, urls: ['/js'], root: 'public'
run LiveStreamingTV::Controller
