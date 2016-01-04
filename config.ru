#!/usr/bin/env ruby
# -*- encoding: utf-8 -*-

require './app'

use Rack::Static, urls: ['/hls', '/js'], root: 'public'
run Sinatra::Application
