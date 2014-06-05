# UI Components #
Here you have the main UI-related components and its interactions.

## Summary ##
- `css`: Components used to handle CSS files
- `Editor`: Extensions to `Editor` compoment
- `logic`: *TBD*
- `menu`: Components used to work with menu options
- `Skins`: *TBD*
- `utils`: Utilities to used to handle DOM elements

## 1. `ComboButton` ##
*TBD*
## 2. `Editor` ##
*TBD*
## 3. `Skin` ##
*TBD*
## 4. `TransitionPanel` ##
*TBD*
## 5. `Widget` ##
A widget is an UI component that can be attached to a parent node/component and can have child widgets as well.

This component extends `Properties` so you can have all features of this module as well. 

Widgets are event aware and have a simple life cycle: Basically after construction you need to cal `show()` method in order to have the `domNode`. `show()` then calls `updateSkin()` and the later calls `onUpdatedSkin()`. This last method is where you can put all logic that requires the `domNode` to be present (i.e.: attach child widgets, or register event handlers).

When you are done with the widget you can call `destroy()` and it will detach all children and call destroy on each one. Also all event handlers are removed from the widget DOM.
  
### `show()` Activity Diagram ###
![show activity diagram](docs/Ninejs_UI_Widget_01.png?raw=true "show activity diagram")

#### `appendIt(parentNode)` Activity Diagram ####
![show activity diagram](docs/Ninejs_UI_Widget_02.png?raw=true "show activity diagram")

#### `postUpdateSkin()` Activity Diagram ####
![show activity diagram](docs/Ninejs_UI_Widget_03.png?raw=true "show activity diagram")

## 6. `Wizard` ##
*TBD*