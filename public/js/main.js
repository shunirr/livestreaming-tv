(function() {
  'use strict';

  var videoSrc = 'hls/stream.m3u8';
  var video;
  var channelList;
  var channelSelect;

  function parseJson(response) {
    return response.json();
  }

  function formatDate(date) {
    return date.getHours() + ':' + ('0' + date.getMinutes()).substr(-2);
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
    var table = document.createElement('table');
    table.setAttribute('border', '1');
    var channels = {};
    programmes.forEach(function(programme) {
      if (typeof channels[programme.name] === 'undefined') {
        channels[programme.name] = [];
      }
      channels[programme.name].push(programme);
    });

    {
      var tr = document.createElement('tr');
      Object.keys(channels).forEach(function(key) {
        var th = document.createElement('th');
	th.textContent = key;
        tr.appendChild(th);
      });
      table.appendChild(tr);
    }

    var now = new Date();
    {
      var tr = document.createElement('tr');
      Object.keys(channels).forEach(function(key) {
        var programme = channels[key][0];
        var start = new Date(programme.start);
        var stop = new Date(programme.stop);
        var td = document.createElement('td');
	var div = document.createElement('div');
	var height = Math.floor((stop - now) / 60000);
        div.setAttribute('style', 'max-height:' + (height * 5) + 'px; overflow:hidden;');
        div.textContent = [formatDate(start), programme.title].join(' ');
	td.setAttribute('valign', 'top');
        td.setAttribute('rowspan', height);
	td.appendChild(div);
        tr.appendChild(td);
      });
      table.appendChild(tr);
    }

    for (var i = 0; i < 5 * 60; i++) {
      var tr = document.createElement('tr');
      Object.keys(channels).forEach(function(key) {
        for (var j = 1; j < channels[key].length; j++) {
	  var programme = channels[key][j];
          var start = new Date(programme.start);
          var stop = new Date(programme.stop);
          var pos = Math.floor((start - now) / 60000);
	  if (i == pos) {
            var td = document.createElement('td');
	    var div = document.createElement('div');
            var height = Math.floor((stop - start) / 60000);
            div.setAttribute('style', 'max-height:' + (height * 5) + 'px; overflow:hidden;');
            div.textContent = [formatDate(start), programme.title].join(' ');
	    td.setAttribute('valign', 'top');
            td.setAttribute('rowspan', height);
	    td.appendChild(div);
            tr.appendChild(td);
	  }
	};
      });
      table.appendChild(tr);
    }
    timetable.appendChild(table);
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
