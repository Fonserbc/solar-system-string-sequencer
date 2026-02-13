# Solar System String Sequencer
[fonserbc.itch.io/ssss](https://fonserbc.itch.io/ssss)
[ferran.games/ssss](https://ferran.games/ssss)

Solar System String Sequencer is a playful music instrument made to explore the musicality of our solar system through the sonification of its planets and their orbits.

### Research question
If we were able to build hypothetical musical strings between celestial bodies, and let these bodies pluck these strings when their orbiting paths cross said strings (when 3 bodies align), how would the resulting music (frequencies and rhythm) sound like?


### Simplifications
1. For UX purposes, the sizes of the planets and the sun are only loosely related to their relative sizes.
2. For the orbits of the planets I'm using [NASA's Keplerian elements](https://ssd.jpl.nasa.gov/planets/approx_pos.html), but I'm not computing changes over time of any element other than computing the mean longitude, because I want this simulation to go on forever.
3. Time always starts at J2000.00 and moves forward.
4. Strings don't break and are able to tense up in order for the wave within the string to travel through the string at the speed of light c.
5. Through the pass of time and change of length of the strings (change of distances between planets), strings are able to maintain a constant speed of the wave within it.
6. String plucking happens in a 2-dimensional simplified coordinate system: 3-dimensional coordinates are projected into the invariable plane of the solar system. Celestial bodies "pluck" strings when their projected center passes over a projected string.
7. We hear strings plucks without delay when they happen regardless of our point of view.

#### Other notes
This project was a fast prototype and jam project made for Operator Digitalfest 2026() within a week, and then polished a bit more for release on itch.io
