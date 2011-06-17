// ==UserScript==
// @name           Ruby5 favorites
// @namespace      http://icanscale.com
// @description    Keep record of your favorite Ruby5 stories or the ones that you want to check later
// @include        http://ruby5.envylabs.com/*
// ==/UserScript==

// jQuery should already be loaded in the site so we don't need to do that

var Ruby5Favorites = function($) {

  function parseUri(uri) {
    var match = uri && uri.match(/(\d+-episode-(\d+)[\w-]*).*#story-(\d+)/);
    return match ? { slug: match[1], episode: match[2]-0, story: match[3]-0 } : {};
  }

  var Story = function(props, title) {
    if (typeof props == "string") {
      props = parseUri(props);
      props.title = title;
    }
    this.slug = props.slug;
    this.episode = props.episode;
    this.story = props.story;
    this.title = props.title;
  }
  Story.prototype.getURI = function () {
    return "http://ruby5.envylabs.com/episodes/" + this.slug + '#story-' + this.story;
  }

  function getFavorites() {
    var favs = localStorage.favorites;
    favs = (favs ? JSON.parse(favs) : []).map(function(fav) {
      return new Story(fav);
    }).sort(function(a,b) {
      return (-a.episode*10+a.story) - (-b.episode*10-b.story);
    });

    function save() {
      localStorage.favorites = JSON.stringify(favs);
    }

    return {
      isFavorite: function(uri) {
        var _ref = parseUri(uri), slug = _ref.slug, story = _ref.story;
        return favs.some(function(fav) { return fav.slug === slug && fav.story === story; });
      },
      addFavorite: function(uri, title) {
        // is it already saved to the list?
        if (this.isFavorite(uri)) return;
        story = new Story(uri, title);
        favs.push(story);
        save();
        this.render();
      },
      removeFavorite: function(uri) {
        // is it in the list?
        var _ref = parseUri(uri), slug = _ref.slug, story = _ref.story;
        var filtered = favs.filter(function(fav) { return fav.slug !== slug || fav.story !== story; });
        if (favs.length !== filtered.length) {
          favs = filtered;
          save();
          this.render();
        }
      },
      all: function() {
        return favs;
      },
      groupedByEpisode: function() {
        return favs.reduce(function(memo, fav) {
          var key = 'Episode '+fav.episode;
          if (memo[key] === undefined) { memo[key] = []; }
          memo[key].push(fav);
          return memo;
        }, {});
      },
      render: function() {
        if ($('#favorites').length == 0) {
          var self = this;
          var list = $('<ul id="favorites-list"></ul>').click(function(e) {
            var target = $(e.target);
            if (target.hasClass('fav-link')) {
              var href = target.attr('href'), story = href.match(/#.*$/)[0], storyId = story.match(/\d+/)[0];
              if (href == window.location.href.replace(/#.*$/, '') + story) {
                // same page, emulating click event on story link
                e.preventDefault();
                $('.stories-listing a.story-link:eq('+storyId+')').click();
              }
            } else if (target.hasClass('fav-del-link')) {
              e.preventDefault();
              var uri = target.prev().attr('href'), story = uri.match(/#.*$/)[0], storyId = story.match(/\d+/)[0];
              self.removeFavorite(uri);
              if (window.location.href.replace(/#.*$/, '') == uri.replace(/#.*$/, '')) {
                $('.stories-listing a.story-link:eq('+storyId+')').parent().find('a.toggle-fav').removeClass('favorite');
              }
            }
          });
          var title = $('<h6>Ruby5 Favorites</h6>').click(function(e) {
            e.preventDefault();
            if (list.is(':hidden')) {
              localStorage.favoritesOpen = "yes";
              $('#favorites h6')
                .animate({width: '163px', textIndent: '0px'}, function() {
                  list.animate({height: "toggle"});
                });
            } else {
              delete localStorage.favoritesOpen;
              list.animate({height: "toggle"}, function() {
                $('#favorites h6').animate({width: '1px', textIndent: '40px'});
              });
            }
          });
          $('<div id="favorites"></div>').appendTo('body')
            .append(title).append(list);
          if (localStorage.favoritesOpen) {
            $('#favorites h6').css({width: '163px', textIndent: '40px'});
          } else {
            list.hide();
          }
        }
        // jQuery .html('') is really slow for this if there are many links
        var list = $('#favorites-list');
        list.get(0).innerHTML = "";
        if (favs.length == 0) {
          list.append('<li>No favorites yet. Mark some favorites with the star icons.</li>');
          return;
        }
        var favsInGroups = this.groupedByEpisode();
        for (var episode in favsInGroups) {
          var epfavs = favsInGroups[episode];
          var eplink =
            $('<a></a>')
              .addClass('episode-link')
              .attr('href', epfavs[0].getURI().replace(/#.*$/, ''))
              .text('Episode '+epfavs[0].episode);
          var eplist = $('<ul></ul>');
          epfavs.forEach(function(fav) {
            eplist.append(
              $('<li></li>').append(
                $('<a></a>').addClass('fav-link').attr('href', fav.getURI())
                  .text(fav.title || 'Story '+fav.story)
              ).append('&nbsp;<a class="fav-del-link" href="#">✖</a>')
            );
          });
          list.append($('<li></li>').append(eplink).append(eplist));
        }
      }
    }
  }

  var isEpisodePage = $('#current-episode-title').length > 0;
  var favorites = getFavorites();
  window.favs = favorites;

  favorites.render();

  if (isEpisodePage) {
    var location = window.location.href;
    if (!location.match(/\/episodes\/\d+/)) {
      // trying to find out premalink
      var slug = $('#current-episode-title').text().trim().toLowerCase().replace(/[ #,-]+/g, '-');
      var prevId = $('h2:eq(1) a').attr('href').match(/\/(\d+)/)[1]-0;
      location = 'http://ruby5.envylabs.com/episodes/'+(prevId+1)+'-'+slug;
    }
    location = location.replace(/(\/stories\/.*)?(#.*)?$/, '');

    $('.stories-listing li').each(function(i) {
      var li = $(this), uri = li.find('a:first').attr('href');
      if (uri.match(/\/stories\//)) {
        uri = uri.replace(/\/stories\/.*$/, '') + '#story-' + i;
      } else if (uri.match(/^#/)) {
        uri = location + uri;
      }
      var title = $(this).find('a').text().replace(/^\s*/, '').replace(/\s*$/, '');

      var star = $('<a href="#" class="toggle-fav"></a>')
        .click(function(e) {
          e.preventDefault();
          e.stopPropagation();
          if ($(this).hasClass('favorite')) {
            favorites.removeFavorite(uri);
            $(this).removeClass('favorite');
          } else {
            favorites.addFavorite(uri, title);
            $(this).addClass('favorite');
          }
        });
      if (favorites.isFavorite(uri)) {
        star.addClass('favorite');
      }
      li.append(star);
    });
  }
}

var script = document.createElement('script');
script.type = 'text/javascript';
script.textContent = '(' + Ruby5Favorites.toString() + ')(jQuery);';
document.body.appendChild(script);

// Add styles
var style = document.createElement('style');
style.type = 'text/css';
style.media = 'screen';
var styles = ' \
  #favorites { \
    position: fixed; \
    top: 0; \
    right: 0; \
    border: solid #ccc; \
    border-width: 0 0 2px 2px; \
    -moz-border-radius-bottomleft: 10px; \
    -webkit-border-bottom-left-radius: 10px; \
    background-color: white; \
  } \
  #favorites h6 { \
    cursor: pointer; \
    width: 1px; \
    height: 32px; \
    padding-right: 36px; \
    border: solid #ccc; \
    border-width: 0 0 1px 1px; \
    -moz-border-radius-bottomleft: 10px; \
    -webkit-border-bottom-left-radius: 10px; \
    line-height: 32px; \
    font-weight: bold; \
    background-color: white; \
    background-position: top left; \
    background-repeat: no-repeat; \
    text-indent: 40px; \
    overflow: hidden; \
  } \
  #favorites-list { \
    margin: 0; \
    padding: 0; \
    max-width: 200px; \
    max-height: 300px; \
    overflow: auto; \
    text-align: left; \
    -moz-border-radius-bottomleft: 10px; \
    -webkit-border-bottom-left-radius: 10px; \
  } \
  #favorites-list li { \
    margin: 0.5em; \
  } \
  #favorites-list ul { \
    margin: 0; \
    padding: 0; \
  } \
  #favorites-list .episode-link { \
    font-weight: bold; \
  } \
  #favorites-list .fav-del-link { \
    text-decoration: none; \
  } \
  .stories-listing li a.toggle-fav { \
    position: absolute; \
    border-width: 0; \
    margin: -8px 0 0 0.25em; \
    width: 32px; \
    height: 32px; \
  } \
  .stories-listing li a.toggle-fav, .stories-listing li a.toggle-fav.favorite { \
    background-color: transparent; \
    background-position: top left; \
    background-repeat: no-repeat; \
  } \
  #favorites h6, .stories-listing li a.toggle-fav.favorite { \
    background-image: url(data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAACAAAAAfBAMAAAB0eNK/AAAAMFBMVEX9/fzw4cDUqEndu2j58+jt3LbXrlPhv2XevXX46ZjozoT+9Kbctlzpznf06dLq1qpq0ydLAAAAAXRSTlMAQObYZgAAAMZJREFUeF6tzz0OgjAABeAOmBgXEgd3X5S/QFw8AMELGG4gR+AEhInZURgMm+EEUCc2QuLAORyMJ9Cm/LQ7b2ny9TXpIzPme5BBAVwJVLv+SLC08kgCz7zuJPDb516CuKiM6X2SJEhL/I+I3wLQKQ0B8JaW0j5lwBvOAB1vqGg4ZOg/90bBoMJrGJLrDEJrnLOyGdR3YQkDYY1n0jKlwhq/pZ1DhTVxkQGNsAY3XDZ4YAQtNFwl1oMRgDMhC0yN9ZHxaUtmyg9bAk7D/4mjcQAAAABJRU5ErkJggg==); \
  } \
  .stories-listing li a.toggle-fav { \
    background-image: url(data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAACAAAAAfBAMAAAB0eNK/AAAAB3RJTUUH2QgHBjYiDLM4HAAAAAlwSFlzAAAewgAAHsIBbtB1PgAAAARnQU1BAACxjwv8YQUAAAAwUExURf39/eHh4aqqqrm5ufHx8a2trdvb27Ozs76+vsDAwPX19eTk5NHR0crKyvj4+AAAAFVO6A8AAAABdFJOUwBA5thmAAAAvElEQVR42mNgoB5IUkPlcykpLUARYFM2SkAR4NQ5NAFF4JH2Jj1UMw2YUU2ddIBHE87h6OjoUNrArQSkGsACTUpKShpwCgjU4RayFUFU6MIELkFU8ChZQ/iblQ5AGNtVwQyeoGqoSr5JYCsnaT6A6eVVBpFGF5B8AiKRfPNIm4FRgAHJN0kGDJd0GZB8M+nAZiUlayTfKO0JChRVPa0EF1Bv0lzANUmjCKFCFegdtiCECiETEOmsSIXYAwMAkd0og/K7L0UAAAAASUVORK5CYII=); \
  } \
';
style.appendChild(document.createTextNode(styles));
document.getElementsByTagName('head')[0].appendChild(style);
