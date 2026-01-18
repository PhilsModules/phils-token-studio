<div align="center">

# Phils Token Studio 🎨

![Foundry v13 Compatible](https://img.shields.io/badge/Foundry-v13-brightgreen?style=flat-square) ![Foundry v12 Compatible](https://img.shields.io/badge/Foundry-v12-green?style=flat-square) ![License](https://img.shields.io/badge/License-GPLv3-blue?style=flat-square)
[![Version](https://img.shields.io/badge/Version-1.5.0-blue?style=flat-square)](https://github.com/PhilsModules/phils-token-studio/releases) [![Patreon](https://img.shields.io/badge/SUPPORT-Patreon-ff424d?style=flat-square&logo=patreon)](https://www.patreon.com/PhilsModules)

<br>

</div>

> [!WARNING]
>
> ### This module is in active development!
>
> It **WILL** contain bugs and incomplete features. Use at your own risk.
>
> ### Dieses Modul befindet sich in aktiver Entwicklung!
>
> Es **WIRD** Fehler und unvollständige Funktionen enthalten. Die Nutzung erfolgt auf eigene Gefahr.

<div align="center">

<br>

**The definitive token editor for Foundry VTT.**
<br>
_Der ultimative Tokeneditor für Foundry VTT._

<br>

<a href="#-english-instructions"><img src="https://img.shields.io/badge/%20-English_Instructions-black?style=for-the-badge&logo=united-kingdom&logoColor=white" alt="English Instructions"></a> <a href="#-deutsche-anleitung"><img src="https://img.shields.io/badge/%20-Deutsche_Anleitung-black?style=for-the-badge&logo=germany&logoColor=red" alt="Deutsche Anleitung"></a> <a href="Updates.md"><img src="https://img.shields.io/badge/%20-Update_Logs-black?style=for-the-badge&logo=clock&logoColor=white" alt="Updates"></a>

</div>

<br>

---

<br>

<div align="center">
<img src="https://github.com/PhilsModules/phils-token-studio/blob/main/pw.png" alt="Preview" width="800">
</div>

<br>

<br>

# <img src="https://flagcdn.com/48x36/gb.png" width="28" height="21" alt="EN"> English Instructions

**Create beautiful, immersive tokens directly within Foundry VTT.**

Phils Token Studio is a modern, high-performance token editor designed to seamlessly integrate with your workflow.

## 🌟 Key Features

### 🎨 Visual Editor

- **Real-time Preview:** See exactly what your token will look like on the canvas as you edit.
- **Layer System:** Robust layer management for **Background**, **Character**, and **Frame**.
- **Context-Aware Eraser:** A smart eraser tool that intelligently targets specific layers without affecting others.

### 🖼️ Asset Management

- **Drag & Drop:** Simply drag images from your file browser or directly onto the canvas.
- **File Browser:** Integrated file picker to select assets directly from your user data.
- **Frame Library (Coming Soon):** Will include a selection of high-quality default frames to get you started immediately.

### 🛠️ Advanced Tools

- **Transform Controls:** Scale, rotate, and position your artwork with precision.
- **Masking:** Automatic masking ensures your character stays strictly within the token ring (unless you want them to pop out!).
- **Pop-Out Effect:** Easily create 3D "pop-out" effects where parts of the character overlap the frame.
- **Dynamic Token Ring Integration:** Full support for Foundry's V12 Dynamic Token Ring system. The studio visualizes the ring guide and automatically configures the scale and subject scale upon export for perfect alignment.
- **Resume Editing:** Your work is automatically saved as a draft. You can close the window and return later to continue exactly where you left off.
- **Undo/Redo:** Made a mistake? Use the undo button to revert your last 50 steps.

## 📦 Installation

1.  Open Foundry VTT.
2.  Go to the **Addon Modules** tab.
3.  Click **Install Module**.
4.  Paste the following **Manifest URL** into the field:
   ```
   https://github.com/PhilsModules/phils-token-studio/releases/latest/download/module.json
   ```
5.  Click **Install**.

## 🚀 Getting Started

1.  **Open the Studio:**
    - **D&D 5e:** Click the three dots (Context Menu) in the sheet header -> "Token Studio".
    - **PF2e / Other Systems:** Hover over the Character Profile Image -> Click the "User/Pen" icon.
    - **Fallback:** If neither works, look for a "Token Studio" icon in the window header (next to the Close button).
2.  **Select a Source:** Drag an image or actor onto the stage.
3.  **Choose a Frame:** Select a frame style from the library.
4.  **Edit:** Use the tools to position, scale, and erase parts of your image.
5.  **Save:** Click save to automatically update the token and prototype token.

<br>

---

<br>

# <img src="https://flagcdn.com/48x36/de.png" width="28" height="21" alt="DE"> Deutsche Anleitung

**Erstelle wunderschöne und immersive Tokens direkt in Foundry VTT.**

Phils Token Studio ist ein moderner und leistungsstarker Tokeneditor, der für einen nahtlosen Arbeitsfluss entwickelt wurde.

## 🌟 Hauptfunktionen

### 🎨 Visueller Editor

- **Echtzeitvorschau:** Sieh genau, wie dein Token auf der Szene aussehen wird, während du ihn bearbeitest.
- **Ebenensystem:** Robustes Ebenenmanagement für **Hintergrund**, **Charakter** und **Rahmen**.
- **Kontextsensitiver Radierer:** Ein intelligenter Radiergummi, der gezielt bestimmte Ebenen bearbeitet, ohne andere Bildteile zu beeinflussen.

### 🖼️ Asset Management

- **Drag & Drop:** Ziehe Bilder einfach aus deinem Dateibrowser oder direkt auf die Leinwand.
- **Dateibrowser:** Integrierte Dateiauswahl, um Assets direkt aus deinen Benutzerdaten zu laden.
- **Rahmenbibliothek (Kommt bald):** Wird eine Auswahl an hochwertigen Standardrahmen enthalten, damit du direkt loslegen kannst.

### 🛠️ Fortgeschrittene Werkzeuge

- **Transformationssteuerung:** Skaliere, rotiere und positioniere deine Grafiken mit präzisen Reglern.
- **Maskierung:** Die automatische Maskierung sorgt dafür, dass dein Charakter strikt im Tokenring bleibt (es sei denn, du willst einen Popouteffekt!).
- **Popouteffekt:** Erstelle einfach 3D Effekte, bei denen Teile des Charakters den Rahmen überlappen.
- **Dynamic Token Ring Integration:** Volle Unterstützung für Foundrys V12 Dynamic Token Ring System. Das Studio visualisiert den Ringguide und konfiguriert beim Export automatisch die Skalierung des Tokens und des Subjekts für eine perfekte Ausrichtung.
- **Später fortsetzen:** Deine Arbeit wird automatisch als Entwurf gespeichert. Du kannst das Fenster schließen und später genau dort weitermachen, wo du aufgehört hast.
- **Rückgängig:** Ein Fehler passiert? Nutze den Zurückknopf, um die letzten 50 Schritte rückgängig zu machen.

## 📦 Installation

1.  Öffne Foundry VTT.
2.  Gehe zum Reiter **Addon Modules**.
3.  Klicke auf **Install Module**.
4.  Füge die folgende **Manifest URL** unten ein:
   ```
    https://github.com/PhilsModules/phils-token-studio/releases/latest/download/module.json
   ```
5.  Klicke auf **Install**.

## 🚀 Erste Schritte

1.  **Öffne das Studio:**
    - **D&D 5e:** Klicke auf die drei Punkte in der Kopfzeile des Charakterbogens -> "Token Studio".
    - **PF2e / Andere Systeme:** Fahre mit der Maus über das Charakterbild -> Klicke das "Stiftsymbol".
    - **Fallback:** Falls nichts davon geht, suche nach dem "Token Studio" Symbol in der Kopfzeile des Fensters.
2.  **Wähle eine Quelle:** Ziehe ein Bild oder einen Akteur auf die Bühne.
3.  **Wähle einen Rahmen:** Suche dir einen Rahmenstil aus der Bibliothek aus.
4.  **Bearbeiten:** Nutze die Werkzeuge zum Positionieren, Skalieren und Radieren.
5.  **Speichern:** Klicke auf Speichern, um den Token und den Prototyptoken automatisch zu aktualisieren.

<br>

---

## 📜 License

This module uses a dual license structure.

- **Code:** GNU GPLv3
- **Assets:** CC BY-NC-ND 4.0

See `LICENSE` file for details.

<br>

<div align="center">
    <h2>❤️ Support the Development</h2>
    <p>If you enjoy this module and want to support open source development for Foundry VTT check out my Patreon.</p>
    <p>Gefällt dir das Modul? Unterstütze die Weiterentwicklung auf Patreon.</p>
    <a href="https://www.patreon.com/PhilsModules">
        <img src="https://c5.patreon.com/external/logo/become_a_patron_button.png" alt="Become a Patron" width="200" />
    </a>
    <br><br>
    <p><i>Made with ❤️ for the Foundry VTT Community</i></p>
</div>


