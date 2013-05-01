Task = xtag.register('x-task', {
  mixins: ['template'],
  lifecycle: {
    created: function(){
      this.setAttribute('template','task');
      this.xtag.data = { text: '', tags: [], date: new Date() };
    },
    inserted: function(){
      xtag.mixins.template.lifecycle.created.call(this);
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
    },
    text: {
      set: function(value){
        this.xtag.data.text = value;
      },
      get: function(){
        return this.xtag.data.text;
      }
    },
    tags: {
      get: function(){
        return this.xtag.data.tags;
      }
    }
  },
  methods: {
    parseText: function(value){
      var self = this;
      this.xtag.data.tags = [];
      value = value.replace(/(\[([\w-]+)\])/g, function(match,cap1,cap2,offset,string){
        console.log('debug', arguments);
        self.xtag.data.tags.push(cap2);
        return '';
      });
      this.xtag.data.text = value;
    }
  }
});

Task.filter = function(filter, callback){

  callback(null, [
    { text: 'go shopping [pizza][party]'},
    { text: 'plan birthday party' },
    { text: 'go skydiving' },
    { text: 'go shopping' },
    { text: 'plan birthday party <p>pizza pizza</p>' },
    { text: 'go skydiving' },
    { text: 'go shopping' },
    { text: 'plan birthday party' },
    { text: 'go skydiving' }
  ]);
};

TaskFilter = xtag.register('x-task-column', {
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
      Task.filter(this.filter, function(err, tasks){
        tasks.forEach(function(item){
          var task = new Task();
          task.parseText(item.text);
          list.appendChild(task);
        });
        xtag.fireEvent(list, 'refreshed');
      });
    }
  }
});

TaskFilter.myFilters = function(callback){
  callback(null, [
    { name: "All", filter: "*", headerColor: "cornflowerblue" },
    { name: "To Sell", filter: "[4sale]", headerColor: "darkorange" }
  ]);
};


Placeholder = xtag.register('x-placeholder',{
  mixins: ['template']
});
