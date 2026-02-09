import { Color, MathUtils } from 'three/webgpu';
import * as Tone from 'tone';

function makeStringLonger(s, n, spacer = ' ')
{
    while (s.length < n) {
        s = s + spacer;
        if (s.length < n) {
            s = spacer +s;
        }
    }
    return s;a
}
let context = null;

export default class timelineDisplay
{
    constructor() {
        this.timelineDiv = document.getElementById("timeline");
        this.timelineStringsDiv = document.getElementById("timelineStrings");
        this.height = this.timelineStringsDiv.offsetHeight;
        this.showing = !this.timelineDiv.classList.contains("hidden");
        this.stringsMap = new Map();
        this.color = new Color();
        context = this;
        this.minStringLength = 10000;
        this.maxStringLength = 0;
    }

    onNotePlayed(string, from, to, player, frequency)
    {
        let notePlayed = Tone.Frequency(frequency);
        let frequencyString = "";
        if (frequency > 1) frequencyString = Math.round(frequency)+" Hz";
        else frequencyString = Math.round(frequency*1000)+" mHz";
        const l = 9;
        console.log(`(${makeStringLonger(from, l)})${makeStringLonger(player, l+2, '-')}(${makeStringLonger(to, l)})\t${frequencyString} [${notePlayed.toNote()}]`);
    }
    
    addString(string) {
        let stringDiv = document.createElement("div");
        stringDiv.classList.add("timelineString");
        let c1 = this.color.setHex(string.from.color).getHexString();
        let c2 = this.color.setHex(string.to.color).getHexString();
        let gradient = "linear-gradient(to right, #"+c1+" , #"+c2+")";
        stringDiv.style.backgroundImage = gradient;
        stringDiv.textContent = string.name;

        this.minStringLength = Math.min(string.length, this.minStringLength);
        this.maxStringLength = Math.max(string.length, this.maxStringLength);

        let p = MathUtils.inverseLerp(this.minStringLength, this.maxStringLength, string.length);
        console.log(p);

        stringDiv.positionY = p;
        stringDiv.style.top = `calc(${p*100}% - ${p*1.5}em)`;
        this.timelineStringsDiv.appendChild(stringDiv);
        this.stringsMap.set(string, stringDiv);
    }

    removeString(string) {
        this.stringsMap.delete(string);
    }

    update(stringsList)
    {
        this.height = this.timelineStringsDiv.offsetHeight;
        stringsList.forEach(string => {
            this.minStringLength = Math.min(string.length, this.minStringLength);
            this.maxStringLength = Math.max(string.length, this.maxStringLength);
        });

        stringsList.forEach(string => {
            let div = this.stringsMap.get(string);
            let p = MathUtils.inverseLerp(this.minStringLength, this.maxStringLength, string.length);
            div.positionY = p;
            div.style.top = `calc(${p*100}% - ${p*1.5}em)`;
        });
    }

    isShowing() {
        return this.showing;
    }

    toggleShow() {
        this.showing = !this.showing;
        if (this.showing) {
            this.timelineDiv.classList.remove("hidden");
        }
        else {
            this.timelineDiv.classList.add("hidden");
        }
    }
}