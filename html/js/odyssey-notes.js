(function () {
    "use strict"

    var Odyssey = window.Odyssey = window.Odyssey || {};

    Odyssey.Notes = {};
    // load stored notes from local storage
    var storedNotes = localStorage.getItem('odyssey-notes');
    Odyssey.Notes.notes = JSON.parse(storedNotes) || {};

    // checks to see if any notes exist for entity (name)
    // and applies them to text
    Odyssey.Notes.applyNotes = function (name, text) {
        // need notes
        var notes = Odyssey.Notes.notes[name];
        if (!notes) return text;
        // apply notes to text
        for (var highlightText in notes) {
            text = text.replace(highlightText, '<span class="highlight">'+highlightText+'</span>');
        }
        return text;
    };

    // add events to show notes when hovering on highlight
    Odyssey.Notes.applyNoteEvents = function (name, $elm) {
        // clear any existing events
        $elm.find('.highlight').unbind('mouseenter');
        // add events
        $elm.find('.highlight').mouseenter( function (e) {
            var highlightText = $(e.target).text();
            var noteText = Odyssey.Notes.notes[name][highlightText];
            if (!noteText) return;
            var $note = $("<div>").addClass("note").text(noteText);
            $("body").append($note);
            // open note tooltip to right of mouse
            var x = e.pageX + 20;
            var y = e.pageY - $(document).scrollTop() + 20;
            $note.css('top', y+'px');
            $note.css('left', x+'px');
            $note.css('z-index', Odyssey.zIndex++);
            $note.show();
            // remove note on mouseout
            $(e.target).one('mouseleave', function () {
                $note.remove();
            });
        } );
    };

    // add mouseup event to capture highlighted text
    $(window).mouseup( function (e) {
        var selection = window.getSelection().toString();
        // if there is no selection then do nothing
        if (!selection.length) return;
        // get entity name
        var name = $(e.target).closest('.bubble').find('.bubble-title').text();
        if (!name) return;
        // create new note from template
        var $note = $('#noteTemplate').clone();
        $note.find('.highlightText').text(selection);
        // open note tooltip just under mouse
        var x = e.pageX - 20;
        var y = e.pageY - $(document).scrollTop() - 20;
        $note.css('top', y+'px');
        $note.css('left', x+'px');
        $note.css('z-index', Odyssey.zIndex++);
        // close note on mouseout
        $note.mouseleave( function () {
            $note.remove();
        });
        // cancel note
        $note.find('.cancel').click( function () {
            $note.remove();
        } );
        // save note
        $note.find('.save').click( function () {
            var highlightText = $note.find('.highlightText').text();
            var noteText = $note.find('.noteText').val();
            var notes = Odyssey.Notes.notes;
            notes[name] = notes[name] || {};
            notes[name][highlightText] = noteText;
            // re-apply highlighting to bubble
            var $overview = $(e.target).closest('.bubble').find('.overview');
            var html = $overview.html();
            html = html.replace(highlightText, '<span class="highlight">'+highlightText+'</span>');
            $overview.html(html);
            // save notes
            localStorage.setItem('odyssey-notes', JSON.stringify(notes));
            $note.remove();
        } );
        $("body").append($note);
        $note.show();
    });

})();
