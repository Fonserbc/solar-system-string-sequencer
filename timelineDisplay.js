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
        this.notesContainer = document.getElementById("timelineNotes");
        this.height = this.timelineStringsDiv.offsetHeight;
        this.showing = !this.timelineDiv.classList.contains("hidden");
        this.stringsMap = new Map();
        this.color = new Color();
        this.color2 = new Color(0xffffff);
        context = this;
        this.minStringLength = 10000;
        this.maxStringLength = 0;
        this.time = 0;

        this.notesList = [];
        this.notesStart = 0;
        this.notesEnd = 0;
        for (let i = 0; i < 128; ++i)
        {
            let newNote = document.createElement("div");
            newNote.classList.add("timelineNote");
            newNote.classList.add("hidden");
            newNote.spawnTime = 0;
            this.notesContainer.appendChild(newNote);
            this.notesList.push(newNote);
        }
    }

    getNoteDiv() {
        let nd = this.notesList[this.notesEnd];
        this.notesEnd = (this.notesEnd + 1)%this.notesList.length;
        return nd;
    }

    onNotePlayed(string, from, to, player, frequency)
    {
        if (!context.isShowing()) return;
        let stringDiv = context.stringsMap.get(string);

        let notePlayed = Tone.Frequency(frequency);
        // let frequencyString = getFrequencyString(frequency);
        // const l = 9;
        // console.log(`(${makeStringLonger(from, l)})${makeStringLonger(player, l+2, '-')}(${makeStringLonger(to, l)})\t${frequencyString} [${notePlayed.toNote()}]`);

        let newNote = context.getNoteDiv();
        newNote.classList.remove("hidden");
        newNote.textContent = notePlayed.toNote();

        let anim = newNote.getAnimations()[0];
        anim.cancel();
        anim.play();

        let c = context.color.setHex(player.color).getHexString();
        newNote.style.backgroundColor = `#${c}`;
        let p = stringDiv.positionY;
        newNote.style.top = `calc(${p*100}% - ${p*1.25}em)`;
        // context.color2.set(1,1,1,1);
        // let textC = context.color2.sub(context.color).getHexString();
        // console.log(textC);
        newNote.style.color = player.name == "sun"? "black" : "white";

        let stringAnim = stringDiv.getAnimations()[0];
        stringAnim.cancel();
        stringAnim.play();
        
        newNote.spawnTime = context.time;
    }

    getFrequencyString(frequency)
    {
        let frequencyString = "";
        if (frequency >= 10000) frequencyString = Math.round(frequency/1000)+" KHz";
        else if (frequency > 1) frequencyString = Math.round(frequency)+" Hz";
        else frequencyString = Math.round(frequency*1000)+" mHz";
        return `${frequencyString} ${Tone.Frequency(frequency).toNote()}`;
    }
    
    addString(string) {
        let stringDiv = document.createElement("div");
        stringDiv.classList.add("timelineString");
        let c1 = this.color.setHex(string.from.color).getHexString();
        let c2 = this.color.setHex(string.to.color).getHexString();
        let gradient = `linear-gradient(to right, #${c1} , #${c2})`;
        stringDiv.style.backgroundImage = gradient;
        stringDiv.textContent = string.name;

        let stringFrequency = document.createElement("div");
        stringFrequency.classList.add("timelineStringFrequency");
        stringDiv.frequencyDiv = stringFrequency;
        stringFrequency.textContent = this.getFrequencyString(string.frequency);
        stringDiv.appendChild(stringFrequency);

        this.minStringLength = Math.min(string.length, this.minStringLength);
        this.maxStringLength = Math.max(string.length, this.maxStringLength);

        
        let p = MathUtils.inverseLerp(Math.log2(this.minStringLength), Math.log2(this.maxStringLength), Math.log2(string.length));

        stringDiv.positionY = p;
        stringDiv.style.top = `calc(${p*100}% - ${p*2.4}em)`;
        stringDiv.minLength = string.length;
        stringDiv.maxLength = string.length;
        this.timelineStringsDiv.appendChild(stringDiv);
        this.stringsMap.set(string, stringDiv);
    }

    removeString(string) {
        let stringDiv = this.stringsMap.get(string);
        this.stringsMap.delete(string);
        stringDiv.remove();
    }

    update(stringsList, time)
    {
        this.time = time;

        
        let i = this.notesStart;
        let noteLifetime = 4.5;
        while (i != this.notesEnd && this.notesList[i].spawnTime + noteLifetime <= time)
        {
            this.notesList[i].classList.add("hidden");
            i = (i + 1)%this.notesList.length;
            this.notesStart = i;
        }

        if (!this.showing) return;

        this.height = this.timelineStringsDiv.offsetHeight;
        this.minStringLength = 10000;
        this.maxStringLength = 0;
        stringsList.forEach(string => {
            let div = this.stringsMap.get(string);
            div.minLength = Math.min(string.length, div.minLength);
            div.maxLength = Math.max(string.length, div.minLength);

            this.minStringLength = Math.min(div.minLength, this.minStringLength);
            this.maxStringLength = Math.max(div.maxLength, this.maxStringLength);
        });

        stringsList.forEach(string => {
            let div = this.stringsMap.get(string);
            let p = MathUtils.inverseLerp(Math.log2(this.minStringLength), Math.log2(this.maxStringLength), Math.log2(string.length));
            div.positionY = p;
            div.style.top = `calc(${p*100}% - ${p*2.4}em)`;
            div.frequencyDiv.textContent = this.getFrequencyString(string.frequency);
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

            let i = this.notesStart;
            while (i != this.notesEnd)
            {
                this.notesList[i].classList.add("hidden");
                i = (i + 1)%this.notesList.length;
                this.notesStart = i;
            }
        }
    }
}