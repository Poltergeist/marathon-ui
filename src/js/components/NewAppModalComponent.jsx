var _ = require("underscore");
var lazy = require("lazy.js");
var React = require("react/addons");
var Util = require("../helpers/Util");

var AppsActions = require("../actions/AppsActions");
var AppsEvents = require("../events/AppsEvents");
var appScheme = require("../stores/appScheme");
var AppsStore = require("../stores/AppsStore");
var appValidator = require("../validators/appValidator");
var CollapsiblePanelComponent =
  require("../components/CollapsiblePanelComponent");
var ContainerSettingsComponent =
  require("../components/ContainerSettingsComponent");
var FormGroupComponent = require("../components/FormGroupComponent");
var ModalComponent = require("../components/ModalComponent");
var OptionalSettingsComponent =
  require("../components/OptionalSettingsComponent");
var ValidationError = require("../validators/ValidationError");

var NewAppModalComponent = React.createClass({
  displayName: "NewAppModalComponent",

  propTypes: {
    attributes: React.PropTypes.object,
    onDestroy: React.PropTypes.func
  },

  getDefaultProps: function () {
    return {
      attributes: lazy(appScheme).extend({
        cpus: 0.1,
        instances: 1,
        mem: 16.0,
        disk: 0.0
      }).value(),
      onDestroy: Util.noop
    };
  },

  getInitialState: function () {
    return {
      errors: []
    };
  },

  componentWillMount: function () {
    AppsStore.on(AppsEvents.CREATE_APP, this.onCreateApp);
    AppsStore.on(AppsEvents.CREATE_APP_ERROR, this.onCreateAppError);
  },

  componentWillUnmount: function () {
    AppsStore.removeListener(AppsEvents.CREATE_APP,
      this.onCreateApp);
    AppsStore.removeListener(AppsEvents.CREATE_APP_ERROR,
      this.onCreateAppError);
  },

  onCreateApp: function () {
    this.clearValidation();
    this.destroy();
  },

  onCreateAppError: function (data, status) {
    this.validateResponse(data, status);

    if (status < 300) {
      this.clearValidation();
      this.destroy();
    }
  },

  destroy: function () {
    // This will also call `this.props.onDestroy` since it is passed as the
    // callback for the modal's `onDestroy` prop.
    this.refs.modalComponent.destroy();
  },

  clearValidation: function () {
    this.setState({errors: []});
  },

  validateResponse: function (response, status) {
    var errors;

    if (status === 422 && response != null &&
        _.isArray(response.errors)) {
      errors = response.errors.map(function (e) {
        return new ValidationError(
          // Errors that affect multiple attributes provide a blank string. In
          // that case, count it as a "general" error.
          e.attribute.length < 1 ? "general" : e.attribute,
          e.error
        );
      });
    } else if (status === 409 && response != null &&
        response.message !== undefined) {
      errors = [
        new ValidationError("general", `Error: ${response.message}`)
      ];
    } else if (status >= 500) {
      errors = [
        new ValidationError("general", "Server error, could not create app.")
      ];
    } else {
      errors = [
        new ValidationError(
          "general",
          "App creation unsuccessful. Check your connection and try again."
        )
      ];
    }

    this.setState({errors: errors});
  },

  onSubmit: function (event) {
    event.preventDefault();

    var attrArray = Util.serializeArray(event.target)
      .filter((key) => key.value !== "");

    var modelAttrs = Util.serializedArrayToDictionary(attrArray);

    // URIs should be an Array of Strings.
    if ("uris" in modelAttrs) {
      modelAttrs.uris = modelAttrs.uris.split(",");
    } else {
      modelAttrs.uris = [];
    }

    // Constraints should be an Array of Strings.
    if ("constraints" in modelAttrs) {
      var constraintsArray = modelAttrs.constraints.split(",");
      modelAttrs.constraints = constraintsArray.map(function (constraint) {
        return constraint.split(":").map(function (value) {
          return value.trim();
        });
      });
    }

    // Ports should always be an Array.
    if ("ports" in modelAttrs) {
      var portStrings = modelAttrs.ports.split(",");
      modelAttrs.ports = _.map(portStrings, function (p) {
        var port = parseInt(p, 10);
        return _.isNaN(port) ? p : port;
      });
    } else {
      modelAttrs.ports = [];
    }

    // mem, cpus, and instances are all Numbers and should be parsed as such.
    if ("mem" in modelAttrs) {
      modelAttrs.mem = parseFloat(modelAttrs.mem);
    }
    if ("cpus" in modelAttrs) {
      modelAttrs.cpus = parseFloat(modelAttrs.cpus);
    }
    if ("disk" in modelAttrs) {
      modelAttrs.disk = parseFloat(modelAttrs.disk);
    }
    if ("instances" in modelAttrs) {
      modelAttrs.instances = parseInt(modelAttrs.instances, 10);
    }

    var model = Util.extendObject(this.props.attributes, modelAttrs);

    // Create app if validate() returns no errors
    if (appValidator.validate(model) == null) {
      AppsActions.createApp(model);
    }
  },

  render: function () {
    var model = this.props.attributes;
    var errors = this.state.errors;

    var generalErrors = errors.filter(function (e) {
        return (e.attribute === "general");
      });

    var errorBlock = generalErrors.map(function (error, i) {
      return <p key={i} className="text-danger"><strong>{error.message}</strong></p>;
    });

    return (
      <ModalComponent
        dismissOnClickOutside={false}
        ref="modalComponent"
        size="md"
        onDestroy={this.props.onDestroy}>
        <form method="post" role="form" onSubmit={this.onSubmit}>
          <div className="modal-header">
            <button type="button" className="close"
              aria-hidden="true" onClick={this.destroy}>&times;</button>
            <h3 className="modal-title">New Application</h3>
          </div>
          <div className="modal-body reduced-padding">
            <FormGroupComponent
                attribute="id"
                label="ID"
                model={model}
                errors={errors}
                validator={appValidator}>
              <input autoFocus required />
            </FormGroupComponent>
            <div className="row">
              <div className="col-sm-3">
                <FormGroupComponent
                    attribute="cpus"
                    label="CPUs"
                    model={model}
                    errors={errors}
                    validator={appValidator}>
                  <input min="0" step="any" type="number" required />
                </FormGroupComponent>
              </div>
              <div className="col-sm-3">
                <FormGroupComponent
                    attribute="mem"
                    label="Memory (MB)"
                    model={model}
                    errors={errors}
                    validator={appValidator}>
                  <input min="0" step="any" type="number" required />
                </FormGroupComponent>
              </div>
              <div className="col-sm-3">
                <FormGroupComponent
                    attribute="disk"
                    label="Disk Space (MB)"
                    model={model}
                    errors={errors}
                    validator={appValidator}>
                  <input min="0" step="any" type="number" required />
                </FormGroupComponent>
              </div>
              <div className="col-sm-3">
                <FormGroupComponent
                    attribute="instances"
                    label="Instances"
                    model={model}
                    errors={errors}
                    validator={appValidator}>
                  <input min="0" step="1" type="number" required />
                </FormGroupComponent>
              </div>
            </div>
            <FormGroupComponent
              attribute="cmd"
              label="Command"
              model={model}
              errors={errors}
              validator={appValidator}>
              <textarea style={{resize: "vertical"}} />
            </FormGroupComponent>
            <hr />
            <div className="row full-bleed">
              <CollapsiblePanelComponent title="optional settings">
                <OptionalSettingsComponent model={model} errors={errors} />
              </CollapsiblePanelComponent>
            </div>
            <div className="row full-bleed">
              <CollapsiblePanelComponent title="docker container settings">
                <ContainerSettingsComponent model={model} errors={errors} />
              </CollapsiblePanelComponent>
            </div>
            <div className="modal-controls">
              {errorBlock}
              <input type="submit" className="btn btn-success" value="+ Create" /> <button className="btn btn-default" type="button" onClick={this.destroy}>
                Cancel
              </button>
            </div>
          </div>
        </form>
      </ModalComponent>
    );
  }
});

module.exports = NewAppModalComponent;
