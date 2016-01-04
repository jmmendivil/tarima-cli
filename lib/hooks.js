function PluginAPI(options) {
  this.hooks = {};
  this.options = options;
}

PluginAPI.prototype.run = function(hook) {
  if (this.hooks[hook]) {
    var args = Array.prototype.slice.call(arguments, 1);

    this.hooks[hook].forEach(function(cb) {
      cb.apply(null, args);
    });
  }
};

PluginAPI.prototype.on = function(hook, cb) {
  if (!this.hooks[hook]) {
    this.hooks[hook] = [];
  }

  this.hooks[hook].push(cb);
};

module.exports = PluginAPI;
