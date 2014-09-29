(function () {
    "use strict"

    var Odyssey = window.Odyssey = window.Odyssey || {};

    // elmement being dragged
    var $dragElm;
    // element being resized
    var $resizeElm;

    // list of entity attributes in display order
    var entityKeys = [
        'name',
        'type',
        'industry',
        'occupation',
        'location',
        'revenue',
        'operating_income',
        'net_income',
        'assets',
        'equity',
        'num_employees',
    ];

    Odyssey.Bubble = function (name, entity) {
        var id = Odyssey.getId(name);

        // check if entity already rendered
        var $bubble = this.$bubble = $('#'+id);

        if ( $bubble.length ) {
            // move to front
            $bubble.css('z-index', Odyssey.zIndex++);
            return;
        }

        // build bubble window from template
        $bubble = this.$bubble = $('#bubbleTemplate').clone().attr('id', id);

        // load data files for entity
        $.get("/json/"+id+"-links.json", function (data) {
            // direct links to entity
            var primaryNodes = {};
            // indirect links to entity
            var secondaryNodes = {};
            // build links
            for (var nameA in data) {
                var nameB = data[nameA];

                if (nameA === name) {
                    primaryNodes[nameB] = 1;
                }
                else if (nameB === name) {
                    primaryNodes[nameA] = 1;
                }
                else {
                    secondaryNodes[nameA] = 1;
                    secondaryNodes[nameB] = 1;
                }
            }

            var $body = $bubble.find('.bubble-body');

            if ( _.size(primaryNodes) ) {
                $body.append( $("<h2>").text("Primary Links") );

                for (var nodeName in primaryNodes) {
                    // get entity
                    var entity = Odyssey.entities.topics[nodeName]
                        || Odyssey.entities.people[nodeName]
                        || Odyssey.entities.institutions[nodeName];
                    // require entity
                    if (!entity) continue;
                    // if entity has an image then insert
                    Odyssey.imageViewAppendImage($body, nodeName, entity);
                }

                $body.append( $("<div>").addClass("cb") );
            }

            if ( _.size(secondaryNodes) ) {
                $body.append( $("<h2>").text("Secondary Links") );

                for (var nodeName in secondaryNodes) {
                    // get entity
                    var entity = Odyssey.entities.topics[nodeName]
                        || Odyssey.entities.people[nodeName]
                        || Odyssey.entities.institutions[nodeName];
                    // require entity
                    if (!entity) continue;
                    // if entity has an image then insert
                    Odyssey.imageViewAppendImage($body, nodeName, entity);
                }

                $body.append( $("<div>").addClass("cb") );
            }
        });

        // increment zIndex so window will be on top
        $bubble.css('z-index', Odyssey.zIndex++);
        // set title
        $bubble.find('.bubble-title').text(name);
        // add event handler to close bubble
        $bubble.find('.bubble-close').click( function () {
            $bubble.remove();
        });
        // on mousedown on header we set this bubble as active for drag
        $bubble.find('.bubble-header').on("mousedown", function (e) {
            $dragElm = $bubble;
        });
        // on mouseup on header bubble is no longer being dragged
        $bubble.find('.bubble-header').on("mouseup", function (e) {
            $dragElm = undefined;
        });
        // on mousedown anywhere in bubble advance z-index to top
        $bubble.on("mousedown", function (e) {
            var z = parseInt($bubble.css('z-index'));
            // do nothing if we already have the highest z-index
            if (z + 1 == Odyssey.zIndex) return;
            // move to front
            $bubble.css('z-index', Odyssey.zIndex++);
        });

        var $body = $bubble.find('.bubble-body');

        // if entity has an image then insert
        if (entity.image) {
            $body.append(
                $('<img>').attr("src", "/images/"+entity.image).addClass("fl")
            );
        }

        var $ul = $("<ul>");
        var count = 0;

        for (var i in entityKeys) {
            var key = entityKeys[i];
            // skip unless key is defined for entity
            if (entity[key] === undefined) continue;
            var val = entity[key];

            // combine multiple entries
            if (typeof(val) == 'object') {
                var vals = [];

                for (var v in val) vals.push(v);

                val = vals.join(', ');
            }

            key = Odyssey.toTitleCase(key);

            $ul.append(
                $("<li>").html('<b>'+key+':</b> '+val)
            );
            count++;
        }

        // add list of attributes to body
        if (count > 0) $body.append(
            $("<div>").append($ul).addClass("info")
        );

        $body.append( $("<div>").addClass("cb") );

        // add overview information if available
        if (entity.overview) {
            // convert to html
            var html = entity.overview.replace(/\n/g, "<br />");
            // apply highlighting/notes
            html = Odyssey.Notes.applyNotes(name, html);
            // create overview
            var $overview = $("<div>").addClass("overview").html(html);
            // add events to show notes when hovering on highlight
            Odyssey.Notes.applyNoteEvents(name, $overview);
            // add overview
            $body.append( $("<h2>").text("Overview") );
            $body.append( $overview );
        }

        // add bubble to body
        $("body").append($bubble);

        $bubble.show();
    };


    // handle dragging / resizing of bubbles
    var lastX;
    var lastY;

    $(window).on('mousemove', function (e) {
        // we need one mouse position to calculate correct delta
        if ( !(lastX && lastY) ) {
            lastX = e.pageX;
            lastY = e.pageY;
            return;
        }
        // calculate deltas
        var deltaX = e.pageX - lastX;
        var deltaY = e.pageY - lastY;
        // store current X/Y as last for next run
        lastX = e.pageX;
        lastY = e.pageY;

        // if there is a draggable element then do drag
        if ($dragElm) {
            var top  = parseInt( $dragElm.css("top") ) + deltaY;
            var left = parseInt( $dragElm.css("left") ) + deltaX;
            $dragElm.css("top", top+"px");
            $dragElm.css("left", left+"px");
        }
        // if there is a resizable elememnt then do resize
        else if ($resizeElm) {

        }
    });

})();
