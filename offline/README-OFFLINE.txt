Face Touch Alert: offline edition
=================================

Runs entirely on your computer. No internet connection is needed, and
nothing you do leaves your machine: the camera image is analysed locally
and never uploaded.

HOW TO START
  1. Unzip the whole folder somewhere (for example, your Documents folder).
     Keep the folders inside it together: the app needs "vendor" and "assets".
  2. Double-click index.html. It opens in your web browser.
  3. Click "Allow" when the browser asks to use your camera.
     Because the page is a local file, the browser may ask again each time.

  The first start takes a few seconds while the face and hand model loads.

WHICH BROWSER
  Works best in Google Chrome, Microsoft Edge, or Firefox.
  Safari may block the camera for pages opened from a file.

IF SOMETHING GOES WRONG
  - "Model file ... is missing": the zip was not fully extracted.
    Unzip it again and open index.html from the extracted folder,
    not from inside the zip preview.
  - No camera prompt: check your browser's camera permission settings
    for local files, and make sure no other app is using the camera.

MODIFYING IT
  All of the app's code is in app.js, kept readable on purpose.
  Edit it with any text editor, save, and reload the page.
  Examples of things you can change:
    - how close a hand must be to trigger an alert  (search for 0.03)
    - the minimum time between alerts              (search for MIN_ALERT_INTERVAL)
  Styles and layout are in index.html.

  The full source, with tests, is at
  https://github.com/EduardoPetrini/face-touch-alert
