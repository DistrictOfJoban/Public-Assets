# LegacyDisplayHelper
This is a (dirty and roughly written) javascript for the Nemo Transit Expansion that attempts to parse and render the legacy NTE display json format, please read the note below.

## Note(!)
1. This script was designed for The District of Joban. There is no plan for further maintenance (Of course PR are still welcomed) as the majority of the displays in Joban has been successfully migrated.
2. If you are writing a new display, please consider writing native Javascript instead of relying on this script.
3. The implementation differs from the way NTE used to display these json formats. The performance is not good and it only refreshes at a peak of ~0.25s. Some features such as route map sliding animation, are therefore disabled entirely.
4. This will very most likely not work on displays with different slots sizes, or the text would appear stretched.

## Using
1. Download `legacy_display_helper.js` from the root of this repository.
2. Put it in your resource pack
3. Fill in the below in a train of your choice in `mtr_custom_resources.json`:
```
"script_texts": [
    "const displayFile = 'mtr:your_json_path/display.json'",
    "const slotsFile = 'mtr:your_json_path/slots.json'",
    "const screenWidth = 1366;",
    "const screenHeight = 384;"
],
"script_files": ["mtr:path_of_your_choice/legacy_display_helper.js"]
```

`displayFile` should point to your display file json.  
`slotsFile` should point to your slots file.  
`screenWidth` and `screenHeight` refers to the displayed texture size of your display. This differs from NTE implementation, where instead of rendering a quad face, this script draws onto a texture instead and renders a single quad face with that texture.

**Finally, you may need to flip your z-axis in your slots file, or it may be displayed on the other side.**

## License
LegacyDisplayHelper is marked with CC0 1.0 Universal