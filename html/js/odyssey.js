(function () {
    "use strict";

    var Odyssey = window.Odyssey = window.Odyssey || {};

    // load history from local storage
    var storedHistory = localStorage.getItem('odyssey-history');
    Odyssey.history = JSON.parse(storedHistory) || [];

    Odyssey.entities = {};

    // as we append new entity windows we always append
    // with the next highest z-index so the window shows
    // on top
    Odyssey.zIndex = 100;

    // load initial data
    $.get("/json/topics.json", function (data) {
        Odyssey.entities.topics = data;
    });
    $.get("/json/people.json", function (data) {
        Odyssey.entities.people = data;
    });
    $.get("/json/institutions.json", function (data) {
        Odyssey.entities.institutions = data;
    });

    Odyssey.getId = function (name) {
        // replace all non chars with - and make lower case
        return name.replace(/(?!\w)[\x00-\xC0]/g, '-').toLowerCase();
    };

    Odyssey.historyView = function () {
        var historyEntities = {}
        // build history entities from history starting with most
        // recent entry
        for (var i = Odyssey.history.length - 1; i >= 0; i--) {
            var name = Odyssey.history[i];
            var entity = Odyssey.entities.topics[name]
                || Odyssey.entities.people[name]
                || Odyssey.entities.institutions[name];
            // require entity
            if (!entity) continue;
            historyEntities[name] = entity;
        }
        // show image view with history, clicking on imageView
        // again will return to previous activeEntities
        Odyssey.imageView(historyEntities);
    };

    Odyssey.init = function () {
        // clear opening slides
        $('.slide').fadeOut();
        // show next step after fadeout
        setTimeout(Odyssey.introOne, 500);
    };

    Odyssey.introOne = function () {
        // set active entities to the default which is the
        // topic set
        Odyssey.activeEntities = Odyssey.entities.topics;
        // show the image view with the base set of topics
        // as the entities to be displayed
        Odyssey.imageView();
        // show intro title
        $('#title-1').fadeIn(function () {
            // show cursor: pointer for all
            $("body").addClass("pointer");
            // go to next step on click
            $(window).one('click', function () {
                Odyssey.introTwo();
                // clear sytle on body that has pointer cursor
                $("body").removeClass("pointer");
            });
        });
    };

    Odyssey.introTwo = function () {
        $('#title-1').fadeOut();
        $('.control').fadeIn();
    };

    Odyssey.imageView = function (entities) {
        Odyssey.activeView = 'image';
        // use last activeEntities by default
        if (entities === undefined)
            entities = Odyssey.activeEntities;
        // clear the list of unrendered entities .. if there are too
        // many entities to render then they will be added here for
        // lazy loading
        var unrenderedEntities = Odyssey.unrenderedEntities = [];
        // clear any existing scroll handlers
        $(window).unbind('scroll');

        $('#map').remove();
        $('#images').remove();
        $('#notes').remove();

        // if we are scrolled then return to top of screen
        $(window).scrollTop();

        var $images = $('<div>').addClass('images').attr('id', 'images');

        var i = 0;

        for (var name in entities)
        {
            var entity = entities[name];
            // only add first hundred images
            if (i++ < 100) {
                Odyssey.imageViewAppendImage($images, name, entity);
            }
            // after that add to unrendered queue for lazy loading
            else {
                unrenderedEntities.push(name);
            }
        }

        // if there are unrendered entities then add scroll event 
        // to lazy load
        if (unrenderedEntities.length) {
            $(window).scroll( function (e) {
                // return unless near end of page
                if ($(window).scrollTop() + $(window).height() < $(document).height() - 300) return;
                // get images div
                var $images = $("#images");
                // without images div nothing to do
                if (!$images.length) {
                    $(window).unbind('scroll');
                    return;
                }
                // add 100 more images
                for (var i=0; i < 100; i++) {
                    // nothing to do if we are out of entities
                    if (unrenderedEntities.length == 0) {
                        $(window).unbind('scroll');
                        break;
                    }
                    // get next entity
                    var name = unrenderedEntities.shift();
                    var entity = entities[name];
                    // append entity image
                    Odyssey.imageViewAppendImage($images, name, entity);
                }
            } );
        }
        
        // append images to body
        $("body").append($images);
    };

    Odyssey.imageViewAppendImage = function ($target, name, entity) {
        // skip entities without images
        if (!entity.image) return;
        // image div
        var $image = $('<div>').addClass('image')
            .css('background-image', 'url("/images/'+entity.image+'")');
        // show bubble permanently on click
        $image.click(
            (function (name, entity, $image) {
                return function (e) {
                    // show buble
                    Odyssey.showBubble(name, entity);
                    // unbind mouseout event from mouseover
                    $image.unbind('mouseout');
                    // add to history
                    Odyssey.history.push(name);
                    // save history
                    localStorage.setItem('odyssey-history', JSON.stringify(Odyssey.history));
                };
            })(name, entity, $image)
        );
        var timeout;
        // show bubble temporarily while hovering
        $image.mouseover(function (e) {
            var id = Odyssey.getId(name);
            var exists = $('#'+id).length;
            // set timeout so that bubble does not flicker when
            // moving mouse across screen
            timeout = setTimeout( function () {
                // show bubble
                var bubble = Odyssey.showBubble(name, entity);
                // position bubble
                var ww = $(window).width();
                var wh = $(window).height();
                var bw = bubble.$bubble.outerWidth();
                var bh = bubble.$bubble.outerHeight();
                // x offset is aligned to 200px grid so that
                // the bubble will open half way into next square
                var ox = 200 - (e.pageX % 200) + 100;
                var x, y;
                // try to position to right of cursor
                if (e.pageX + ox + bw < ww) {
                    x = e.pageX + ox;
                    bubble.$bubble.css('left', x+'px');
                }
                // position to left if no space
                else {
                    // open with right side half way into previous square
                    x = e.pageX - (e.pageX % 200) - 100 - bw;
                    if (x < 0) x = 50;
                    bubble.$bubble.css('left', x+'px');
                }
                // try to position vertically so bubble is centered
                // on mouse point
                y = e.pageY - parseInt(bw/2);
                // if bubble is past bottom of window then move up so that
                // bottom is 50px above bottom
                if (y + bh > wh) y = wh - bh - 50;
                // if top of bubble is above window then move down so that
                // top of bubble is 50 px below top of window
                if (y < 0) y = 50;

                bubble.$bubble.css('top', y+'px');
            }, 300);
            // add event handler that will clear bubble next
            // time mouse leaves the parent image
            $image.one('mouseout', function () {
                // if we leave square before bubble timeout fires
                // then this will prevent bubble from ever showing
                clearTimeout(timeout);
                // if bubble was already showing then do not add
                // mouseout event
                if (exists) return;
                $('#'+id).remove();
            });

        });
        // append image to images div
        $target.append($image);
    };

    Odyssey.mapView = function () {
        Odyssey.activeView = 'map';

        var entities = Odyssey.activeEntities;

        $('#map').remove();
        $('#images').remove();
        $('#notes').remove();

        $("body").append( $("<div>").attr("id", "map").addClass("map") );

        var mapOptions = {
            center: { lat: 30.53, lng: -1.69},
            zoom: 3
        };

        Odyssey.map = new google.maps.Map(document.getElementById('map'), mapOptions);

        // keep track of markers
        Odyssey.markers = [];

        for (var name in entities)
        {
            var entity = entities[name];
            // skip entities without lat/lng
            if (!entity.geocode) continue;
            // create marker
            var marker = new google.maps.Marker({
                  position: new google.maps.LatLng(entity.geocode.lat, entity.geocode.lng),
                  map: Odyssey.map,
                  icon: '/triangle-32.png'
            });
            // add click event
            google.maps.event.addListener(
                marker,
                'click',
                (function (name, entity) {
                    return function () {
                        Odyssey.showBubble(name, entity);
                        // add to history
                        Odyssey.history.push(name);
                        // save history
                        localStorage.setItem('odyssey-history', JSON.stringify(Odyssey.history));
                    };
                })(name, entity)
            );
            // build infowindow to show on hover
            var infowindow = new google.maps.InfoWindow({
                content: '<img src="/images/'+entity.image+'"/>'
            });
            // show infowindow on mouse over
            google.maps.event.addListener(marker, 'mouseover',
                (function (infowindow, map, marker) {
                    return function () { infowindow.open(map, marker) }
                })(infowindow, Odyssey.map, marker)
            );
            // hide infowindow on mouse over
            google.maps.event.addListener(marker, 'mouseout',
                (function (infowindow, map, marker) {
                    return function () { infowindow.close(map, marker) }
                })(infowindow, Odyssey.map, marker)
            );
            // store marker
            Odyssey.markers.push(marker);
        }
    };

    Odyssey.notesView = function () {
        $('#map').remove();
        $('#images').remove();
        $('#notes').remove();

        // get entity names for notes in alpha order
        var noteNames = [];
        for (var name in Odyssey.Notes.notes) noteNames.push(name);
        noteNames = noteNames.sort();
    
        var $notes = $("<div>").attr("id", "notes").addClass("notes");

        for (var i in noteNames) {
            var name = noteNames[i];
            // get entity
            var entity = Odyssey.entities.topics[name]
                || Odyssey.entities.people[name]
                || Odyssey.entities.institutions[name];
            // require entity
            if (!entity) continue;
            // create note
            var $note = $("<div>");
            // if entity has an image then insert
            Odyssey.imageViewAppendImage($note, name, entity);
            // get notes for entity
            var notes = Odyssey.Notes.notes[name];
            // add highlighted text and note to div
            for (var highlightText in notes) {
                var noteText = notes[highlightText];
                $note.append( $("<div>").addClass("highlightText").text(highlightText) );
                $note.append( $("<div>").addClass("noteText").text(noteText) );
                $note.append( $("<br>") );
            }
            $note.append( $("<div>").addClass("cb") );
            $notes.append($note);
            $notes.append( $("<hr>") );
        }

        $("body").append($notes);
    };

    Odyssey.showEntities = function (type) {
        // need valid entity type that is loaded
        if (!Odyssey.entities[type]) return;
        // set active entity set
        Odyssey.activeEntities = Odyssey.entities[type];

        if (Odyssey.activeView == 'map') {
            Odyssey.mapView();
        }
        else if (Odyssey.activeView == 'image') {
            Odyssey.imageView();
        }
    }
    
    Odyssey.showBubble = function (name, entity) {
        return new Odyssey.Bubble(name, entity);
    };

    Odyssey.toTitleCase = function(str) {
        return str.split('_').join(' ').replace(
            /\w\S*/g,
            function(txt){return txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase();}
        );
    }

})();

$(function () {
    // show cursor: pointer for all
    $("body").addClass("pointer");
    // go to next step on click
    $(window).one('click', function () {
        Odyssey.init();
        // clear sytle on body that has pointer cursor
        $("body").removeClass("pointer");
    });
});

// show map info
Mousetrap.bind(['command+m', 'ctrl+m'], function(e) {
    if (!Odyssey.map) return;

    var center = Odyssey.map.getCenter();
    var zoom   = Odyssey.map.getZoom();

    var latLngZoom = center.lat() + ', ' + center.lng() + ', ' + zoom;

    confirm(latLngZoom);
});
