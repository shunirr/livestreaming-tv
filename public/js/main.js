(function() {
  'use strict';

  var videoSrc = 'hls/stream.m3u8';
  var video;
  var channelList;
  var channelSelect;

  function parseJson(response) {
    return response.json();
  }

  function formatDate(start, stop) {
    return start.getHours() + ':' + ('0' + start.getMinutes()).substr(-2) + ' - ' +
      stop.getHours() + ':' + ('0' + stop.getMinutes()).substr(-2);
  }

  function selectChannel(event) {
    var checked = channelList.querySelector('[name="ch"]:checked');
    if (typeof checked == 'undefined') {
      return;
    }
    var body = new FormData();
    body.append('ch', checked.value);
    fetch('channels/select', {
      method: 'post',
      body: body,
      mode: 'same-origin',
      credentials: 'same-origin',
      cache: 'no-store'
    });
  }

  function initChannels(channels) {
    var df = document.createDocumentFragment();
    channels.forEach(function(channel) {
      var input = document.createElement('input');
      var label = document.createElement('label');
      var remoconNumber = channel['remocon_number'];
      input.id = remoconNumber;
      input.value = remoconNumber;
      input.setAttribute('type', 'radio');
      input.setAttribute('name', 'ch');
      label.setAttribute('for', remoconNumber);
      label.textContent = channel.name;
      df.appendChild(input);
      df.appendChild(label);
    });
    channelList.appendChild(df);
    getCurrentChannel();
  }

  function getCurrentChannel() {
    fetch('channels/current', {
      method: 'get',
      mode: 'same-origin',
      credentials: 'same-origin',
      cache: 'no-store'
    }).then(parseJson).then(function(json) {
      document.getElementById(json[1]).checked = true;
    });
  }

  function initProgrammes(programmes) {
    var timetable = document.getElementById('timetable');
    var ul = document.createElement('ul');
    programmes.forEach(function(programme) {
      var li = document.createElement('li');
      var ul2 = document.createElement('ul');
      var li2 = document.createElement('li');
      var start = new Date(programme.start);
      var stop = new Date(programme.stop);
      li.textContent = formatDate(start, stop);
      li2.textContent = [programme.name, programme.title].join(' ');
      ul2.appendChild(li2);
      li.appendChild(ul2);
      ul.appendChild(li);
    });
    timetable.appendChild(ul);
  }

  function capture() {
    if (typeof video === 'undefined') {
      return;
    }
    var canvas = document.createElement('canvas');
    var context = canvas.getContext('2d');
    var body = new FormData();
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    context.drawImage(video, 0, 0);
    body.append('url', canvas.toDataURL());
    fetch('tweet', {
      method: 'post',
      body: body,
      mode: 'same-origin',
      credentials: 'same-origin',
      cache: 'no-store'
    }).then(function() {
      canvas = undefined;
    });
  }

  function bind() {
    var hls;
    video = document.getElementById('video');
    channelList = document.getElementById('channel_list');
    channelSelect = document.getElementById('channel_select');
    channelSelect.addEventListener('click', selectChannel);
    if (video.canPlayType('application/vnd.apple.mpegURL')) {
      video.setAttribute('src', videoSrc);
    } else if (Hls.isSupported()) {
      hls = new Hls();
      hls.loadSource(videoSrc);
      hls.attachMedia(video);
      hls.on(Hls.Events.MANIFEST_PASED, video.play.bind(video));
    } else {
      return;
    }
    fetch('channels', {
      method: 'get',
      mode: 'same-origin',
      credentials: 'same-origin',
      cache: 'no-store'
    }).then(parseJson).then(initChannels);
    fetch('programmes', {
      method: 'get',
      mode: 'same-origin',
      credentials: 'same-origin',
      cache: 'no-store'
    }).then(parseJson).then(initProgrammes);
  }

  window.addEventListener('keyup', function(event) {
    if (event.keyCode === 84) {
      capture();
    }
  });
  document.addEventListener('DOMContentLoaded', bind);
})();
