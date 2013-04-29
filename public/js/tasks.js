

xtag.register('x-task', {
  mixins: ['template'],
  lifecycle: {
    created: function(){
      this.setAttribute('template','task');
      this.xtag.data = {};
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
    }
  }

});

xtag.register('x-task-column', {
  lifecycle: {
    created: function(){}
  },
  accessors: {
    filter: {
      get:  function(){

      },
      set: function(){

      }
    },
    title: {
      get: function(){

      },
      set: function(){

      }
    }
  }
});