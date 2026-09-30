# Lab 01: Your First Web Map
**Web GIS Course at IGIS, NUST**

*Sohail Zulfiqar - 578135*

## Checkpoints

### Checkpoint 1: VS Code Setup
*Screenshot showing the VS Code window with the empty `C:\webgis` folder open in the Explorer panel, and the Live Server extension visible as installed.*

![Checkpoint 1: VS Code Setup](/images/checkpoint-1.png)

### Checkpoint 2: Your First Web Page
*Screenshot of the browser showing the HTML page, with Developer Tools open on the Elements tab, and the address bar visible showing `127.0.0.1`.*

![Checkpoint 2: First Web Page](/images/checkpoint-2.png)

### Checkpoint 3: Styling with CSS
*Screenshot of the page showing the styled heading and subtitle, with the Elements panel open and the map `div` selected so its CSS rules are visible on the side.*

![Checkpoint 3: CSS Styling](/images/checkpoint-3.png)

### Checkpoint 4: Add the Map
*Screenshot of the working map with the Network tab open, showing the tile requests, with one PNG request selected and its Preview tab visible.*

![Checkpoint 4: Map and Network Requests](/images/checkpoint-4.png)

### Checkpoint 5: Publish It
*Screenshot of the live GitHub Pages URL open in a browser, with the address bar clearly visible showing the `.github.io` address.*

![Checkpoint 5: GitHub Pages Live URL](/images/checkpoint-5.png)

## Additional Tasks

### Circles & Map Markers
*Screenshot showing the more than one Map Markers and having circles on them.*

![Additional Checkpoint : Map Markers & Circles](/images/circle.png)

## Questions and Answers

**1. In Part 2 your page made one network request. After Part 4 it made dozens. Explain in two or three sentences what changed and why.**
Initially, the browser only made a single request for the index.html file. After adding the Leaflet script, the browser makes dozens of requests to fetch individual 256 by 256 pixel background map tile images. This happens because the map is not a static picture, but rather an ongoing conversation with a server that loads new tiles as the map is viewed or panned. 

**2. What is the difference between what HTML does and what CSS does? Give one example of each from your own file.**
HTML dictates what content exists on the page, whereas CSS controls how that content looks. 
An example of HTML is <h1>Islamabad</h1>, which structuralizes text as a top-level heading. 
An example of CSS is the #map rule (height: 480px; width: 100%;), which defines the dimensions and appearance of the map container. 

**3. Why does the `#map` rule need a height, when the `h1` rule does not?**
An empty <div> tag has a default height of zero. If the #map CSS rule does not specify a height, Leaflet will draw the map into a box that is zero pixels tall, making it completely invisible on the page. 

**4. You opened your page through Live Server at 127.0.0.1 instead of double-clicking the file. Give one reason this matters.**
Browsers have security measures that block data file requests for pages opened directly from the local file system. Running the page through Live Server provides a real local web environment, ensuring map data loads properly instead of silently failing. 

**5. A classmate's marker appears in the sea near Africa instead of in Islamabad. What is almost certainly wrong, and how would you fix it?**
The latitude and longitude coordinates are swapped. Leaflet's functions expect coordinates in (latitude, longitude) order. To fix this, reverse the order of the two coordinate numbers provided to the marker. 