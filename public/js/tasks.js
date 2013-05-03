db.open({
  server: 'app',
  version: 1,
  schema: {
    column: {
      key: { keyPath: 'id', autoIncrement: true },
      feeds: { },
      indexes: {
        name: { unique: true }
      }
    }
  }
}).done(function(s){
  xtag.fireEvent(document, 'dbconnected', { server: s });
});


Item = xtag.register('x-item', {
  mixins: ['template'],
  lifecycle: {
    created: function(){
      this.setAttribute('template','rsspost');
      this.xtag.data = { head: '', text: '', date: new Date() };
    },
    inserted: function(){
      xtag.mixins.template.lifecycle.created.call(this);
    }
  },
  accessors: {
    templateData: {
      get: function(){
        return this.xtag.data;
      }
    },
    head: {
      set: function(value){
        this.xtag.data.head = value;
      },
      get: function(){
        return this.xtag.data.head;
      }
    },
    text: {
      set: function(value){
        this.xtag.data.text = value;
      },
      get: function(){
        return this.xtag.text.head;
      }
    },
    date: {
      get: function(){
        return this.xtag.data.date;
      }
    }
  }
});

Column = xtag.register('x-task-column', {
  mixins: ['request'],
  lifecycle: {
    created: function(){
      this.xtag.data = {
        name: 'Column',
        filter: '*',
        headerColor: '#bbb'
      };
      this.innerHTML = "";
    }
  },
  accessors: {
    filter: {
      get:  function(){
        return this.xtag.data.filter;
      },
      set: function(value){
        this.xtag.data.filter = value;
        this.refresh();
      }
    },
    name: {
      get: function(){
        return this.xtag.data.name;
      },
      set: function(value){
        this.xtag.data.name = value;
      }
    },
    headerColor: {
      get: function(){
        return this.xtag.data.headerColor;
      },
      set: function(value){
        this.xtag.data.headerColor = value;
      }
    }
  },
  methods: {
    refresh: function(){
      var list = this;
      list.innerHTML = "";

      var feeds = this.filter.map(function(item, idx){
        return 'rssurl' + idx + '=' + escape(item);
      }).join('&');

      console.log(feeds);
      this.dataset.callbackKey = '_callback';
      this.dataready = function(e){
        e.responseText.value.items.forEach(function(post){
          console.log(post);
          var item = new Item();
          item.head = post.title;
          //item.text = post.description;
          item.date = post.pubDate;
          list.appendChild(item);
        });
      }
      var src =  "http://pipes.yahoo.com/pipes/pipe.run?_id=c4813879bcf601e126cb5cb4b4cdd587&_render=json&" + feeds;
      console.log(src);
      this.src = src;
    }
  }
});

Column.myColumns = function(callback){
  //TODO call indexdb for columns
  dbconnection.column.query().filter().execute().done(callback);
};

Column.create = function(name, feeds, color, callback){
    // index db, if exists, update it ?
    console.log(arguments);

    dbconnection.query('column').filter('name', name).execute().done(function(results){
      if (results.length==1){
        console.log('update', results[0]);
        dbconnection.column.update({
          id: results[0].id,
          name: name,
          feeds: feeds,
          headerColor: color
        }).done(callback);
      } else {
        console.log('create');
        dbconnection.column.add({
          name: name,
          feeds: feeds,
          headerColor: color
        }).done(callback);
      }
    });

};

Placeholder = xtag.register('x-placeholder',{
  mixins: ['template'],
  lifecycle: {
    created: function(){
      this.xtag.data = {};
    }
  },
  accessors: {
    templateData: {
      get: function(){
        return this.xtag.data;
      },
      set: function(value){
        this.xtag.data = value;
      }
    }
  }
});
