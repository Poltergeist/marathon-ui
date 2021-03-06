var classNames = require("classnames");
var React = require("react/addons");

var TooltipMixin = require("../mixins/TooltipMixin");

function roundWorkaround(x) {
  return Math.floor(x * 1000) / 1000;
}

var AppHealthComponent = React.createClass({
  displayName: "AppHealthComponent",

  mixins: [TooltipMixin],

  propTypes: {
    model: React.PropTypes.object.isRequired
  },

  handleMouseOverHealthBar: function (ref) {
    var el = this.refs[ref].getDOMNode();
    this.tip_showTip(el);
  },

  handleMouseOutHealthBar: function (ref) {
    var el = this.refs[ref].getDOMNode();
    this.tip_hideTip(el);
  },

  getHealthData: function () {
    var model = this.props.model;

    var tasksWithUnknownHealth = Math.max(
      model.tasksRunning -
      model.tasksHealthy -
      model.tasksUnhealthy,
      0
    );

    var healthData = [
      {quantity: model.tasksHealthy, name: "healthy"},
      {quantity: model.tasksUnhealthy, name: "unhealthy"},
      {quantity: tasksWithUnknownHealth, name: "running"},
      {quantity: model.tasksStaged, name: "staged"}
    ];

    // cut off after `instances` many tasks...
    var tasksSum = 0;
    for (var i = 0; i < healthData.length; i++) {
      var capacityLeft = Math.max(0, model.instances - tasksSum);
      tasksSum += healthData[i].quantity;
      healthData[i].quantity = Math.min(capacityLeft, healthData[i].quantity);
    }

    // ... show everything above that in blue
    var overCapacity = Math.max(0, tasksSum - model.instances);

    healthData.push({quantity: overCapacity, name: "over-capacity"});

    // add unscheduled task, or show black if completely suspended
    var isSuspended = model.instances === 0 && tasksSum === 0;
    var unscheduled = Math.max(0, (model.instances - tasksSum));
    var unscheduledOrSuspended = isSuspended ? 1 : unscheduled;

    healthData.push({quantity: unscheduledOrSuspended, name: "unscheduled"});

    return healthData;
  },

  getHealthBar: function () {
    var healthData = this.getHealthData();

    // normalize quantities to add up to 100%. Cut off digits at
    // third decimal to work around rounding error leading to more than 100%.
    var dataSum = healthData.reduce(function (a, x) {
      return a + x.quantity;
    }, 0);

    var allZeroWidthBefore = true;
    return healthData.map(function (d, i) {
      var width = roundWorkaround(d.quantity * 100 / dataSum);
      var classSet = {
        // set health-bar-inner class for bars in the stack which have a
        // non-zero-width left neightbar
        "health-bar-inner": width !== 0 && !allZeroWidthBefore,
        "progress-bar": true
      };
      // add health bar name
      classSet["health-bar-" + d.name] = true;

      if (width !== 0) {
        allZeroWidthBefore = false;
      }

      let attributes = {};
      if (d.quantity > 0) {
        let ref = "healthBar-" + i;
        attributes = {
          "ref": ref,
          "data-behavior": "show-tip",
          "data-tip-type-class": "default",
          "data-tip-place": "top",
          "data-tip-content": d.name,
          "onMouseOver": this.handleMouseOverHealthBar.bind(null, ref),
          "onMouseOut": this.handleMouseOutHealthBar.bind(null, ref)
        };
      }

      return (
        <div
          className={classNames(classSet)}
          style={{width: width + "%"}}
          {...attributes}
          key={i} />
      );
    }.bind(this));
  },

  render: function () {
    return (
      <div className="progress health-bar">
        {this.getHealthBar()}
      </div>
    );
  }
});

module.exports = AppHealthComponent;
