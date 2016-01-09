LiveStreaming TV
=====

## Require

* Windows
* RecTest
* ffmpeg
    * x264
    * fdk-aac
* PT3
* Ruby
* nginx
    * [nginx-rtmp-module](https://github.com/arut/nginx-rtmp-module)
* [BonDriverController](https://github.com/shunirr/BonDriverController)

## Usage

```sh
SET CONSUMER_KEY=YOUR_TWITTER_CONSUMER_KEY
SET CONSUMER_SECRET=YOUR_TWITTER_CONSUMER_SECRET
SET ACCESS_TOKEN=YOUR_TWITTER_ACCESS_TOKEN
SET ACCESS_TOKEN_SECRET=YOUR_TWITTER_ACCESS_TOKEN_SECRET
bundle exec rackup
```

## Sample nginx settings

```
rtmp {
  server {
    listen 1935;

    application hls {
      live on;
      hls  on;
      hls_path html/hls;
      hls_fragment 2s;
      hls_type live;
      hls_playlist_length 6;
      hls_cleanup on;
    }
  }
}
server {
  listen 80;
  server_name localhost;

  root html;
  client_max_body_size 20m;

  location /hls {
    types {
      application/vnd.apple.mpegurl m3u8;
    }
    add_header Cache-Control no-cache;
  }
  location / {
    proxy_pass http://127.0.0.1:9292/;
  }
}
```

## License

Apache License v2.

