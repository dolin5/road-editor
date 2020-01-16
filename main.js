require([
  "esri/Map",
  "esri/layers/FeatureLayer",
  "esri/widgets/Editor",
  "esri/views/MapView",
  "esri/WebMap",
  "esri/widgets/LayerList",
  "esri/widgets/BasemapGallery",
  "esri/widgets/Expand",
  "esri/popup/content/AttachmentsContent",
  "esri/popup/content/TextContent"
], function(
  Map,
  FeatureLayer,
  Editor,
  MapView,
  WebMap,
  LayerList,
  BasemapGallery,
  Expand,
  AttachmentsContent,
  TextContent
) {
  // Create the Map
  const webMap = new WebMap({
    portalItem: {
      id:"c7cc429e330b42abaa0c1db7bdab563f"
    }  
  });
  let editor, features;
  /*************************************************************
   * The PopupTemplate content is the text that appears inside the
   * popup. Bracketed {fieldName} can be used to reference the value
   * of an attribute of the selected feature. HTML elements can be
   * used to provide structure and styles within the content.
   **************************************************************/
  const editThisAction = {
    title: "Edit feature",
    id: "edit-this",
    className: "esri-icon-edit"
  };

  function roadName(feature) {
    const roadNameAttributes = ["DIRPRE", "ROADNAME", "ROADTYPE", "DIRSUF"];
    let roadName = "";
    roadNameAttributes.forEach(function(f) {
      if (feature.graphic.attributes[f] == null) {
        return;
      }
      roadName += " " + feature.graphic.attributes[f];
    });
    return roadName.replace(/\s+/g, " ").trim();
  }

  // Create a popupTemplate for the featurelayer and pass in a function to set its content and specify an action to handle editing the selected feature
  const template = {
    title: roadName,
    //content: difficultyLevel,
    /*fieldInfos: [
        {
          fieldName: "trailName"
        },
        {
          fieldName: "difficulty"
        }
      ],*/
    actions: [editThisAction]
  };

  // Function that creates two popup elements for the template: attachments and text
  function difficultyLevel(feature) {
    // 1. Set how the attachments should display within the popup
    const attachmentsElement = new AttachmentsContent({
      displayType: "list"
    });

    const textElement = new TextContent();

    const level = feature.graphic.attributes.condition;
    const green = "<b><span style='color:green'>" + level + "</span></b>.";
    const purple = "<b><span style='color:purple'>" + level + "</span></b>.";
    const red = "<b><span style='color:red'>" + level + "</span></b>.";

    // If the feature's "difficulty" attribute is a specific value, set it a certain color
    // "easy" = green
    // "medium" = purple
    // "hard" = red
    switch (level) {
      case "easy":
        textElement.text =
          "The {trailName} trail has a difficulty level of " + green;
        return [textElement, attachmentsElement];
        break;
      case "medium":
        textElement.text =
          "The {trailName} trail has a difficulty level of " + purple;
        return [textElement, attachmentsElement];
        break;
      case "hard":
        textElement.text =
          "The {trailName} trail has a difficulty level of " + red;
        return [textElement, attachmentsElement];
    }
  }

  const featureLayer = new FeatureLayer({
    portalItem: {
      id: "9a26e4d20f2a40959aa4a8508d470394"
    },
    outFields: ["*"],
    popupTemplate: template,
    listMode:"hide"
  });
  webMap.add(featureLayer);

  // Create the MapView
  const view = new MapView({
    container: "viewDiv",
    map: webMap,
    zoom: 11,
    center: [-111.17, 45.7]
  });

  
  view.when(function() {
    // Create a BasemapGallery widget instance and set
// its container to a div element

    var basemapGallery = new BasemapGallery({
      view: view,
      container: document.createElement("div")
    });

    // Create an Expand instance and set the content
    // property to the DOM node of the basemap gallery widget

    var bgExpand = new Expand({
      view: view,
      content: basemapGallery
    });
    view.ui.add(bgExpand, "top-left");
    const layerList = new LayerList({
      view: view
    });
    view.ui.add(layerList,"top-left");
    // Create the Editor with the specified layer and a list of field configurations
    editor = new Editor({
      view: view,
      container: document.createElement("div"),
      
      layerInfos: [
        {
          layer: featureLayer,
          fieldConfig: [
            {
              name: "MAINTENANCE",
              label: "Maintenance",
              editable: true
            },
            {
              name: "OWNERSHIP",
              label: "OWNERSHIP",
              editable: true
            },

          ],
          addEnabled:false,
          deleteEnabled:false,
        },        
      ]
    });
    view.ui.add(editor, "top-right");

    // Execute each time the "Edit feature" action is clicked
    function editThis() {
      // If the EditorViewModel's activeWorkflow is null, make the popup not visible
      if (!editor.viewModel.activeWorkFlow) {
        view.popup.visible = false;
        // Call the Editor update feature edit workflow

        editor.startUpdateWorkflowAtFeatureEdit(view.popup.selectedFeature);
        view.popup.spinnerEnabled = false;
      }

      // We need to set a timeout to ensure the editor widget is fully rendered. We
      // then grab it from the DOM stack
      setTimeout(function() {
        // Use the editor's back button as a way to cancel out of editing
        let arrComp = editor.domNode.getElementsByClassName(
          "esri-editor__back-button esri-interactive"
        );
        if (arrComp.length === 1) {
          // Add a tooltip for the back button
          arrComp[0].setAttribute("title", "Cancel edits, return to popup");
          // Add a listerner to listen for when the editor's back button is clicked
          arrComp[0].addEventListener("click", function(evt) {
            // Prevent the default behavior for the back button and instead remove the editor and reopen the popup
            evt.preventDefault();
            view.ui.remove(editor);
            view.popup.open({
              features: features
            });
          });
        }
      }, 150);
    }

    // Event handler that fires each time an action is clicked
    view.popup.on("trigger-action", function(event) {
      if (event.action.id === "edit-this") {
        editThis();
      }
    });
  });

  // Watch when the popup is visible
  view.popup.watch("visible", function(event) {
    // Check the Editor's viewModel state, if it is currently open and editing existing features, disable popups
    if (editor.viewModel.state === "editing-existing-feature") {
      view.popup.close();
    } else {
      // Grab the features of the popup
      features = view.popup.features;
    }
  });

  featureLayer.on("apply-edits", function() {
    // Once edits are applied to the layer, remove the Editor from the UI
    view.ui.remove(editor);

    // Iterate through the features
    features.forEach(function(feature) {
      // Reset the template for the feature if it was edited
      feature.popupTemplate = template;
    });

    // Open the popup again and reset its content after updates were made on the feature
    if (features) {
      view.popup.open({
        features: features
      });
    }

    // Cancel the workflow so that once edits are applied, a new popup can be displayed
    editor.viewModel.cancelWorkflow();
  });
});
