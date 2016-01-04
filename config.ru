#!/usr/bin/env ruby
# -*- encoding: utf-8 -*-

require './app'

use Rack::Static, urls: [''], root: 'public', index: 'index.html'
run Sinatra::Application
