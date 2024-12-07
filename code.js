import { initializeApp } from "https://www.gstatic.com/firebasejs/11.0.1/firebase-app.js";
import { getAnalytics } from "https://www.gstatic.com/firebasejs/11.0.1/firebase-analytics.js";
import { getDatabase, ref, get, child, update, remove, onValue } from "https://www.gstatic.com/firebasejs/11.0.1/firebase-database.js";
import { getStorage, ref as stRef, deleteObject, getDownloadURL, uploadBytesResumable } from "https://www.gstatic.com/firebasejs/11.0.1/firebase-storage.js";

const firebaseConfig = {
    apiKey: "AIzaSyCehSw4B4NlVVUlpveHdGsSXQZz0lpWRfw",
    authDomain: "cn-drive-f5fe0.firebaseapp.com",
    databaseURL: "https://cn-drive-f5fe0-default-rtdb.firebaseio.com",
    projectId: "cn-drive-f5fe0",
    storageBucket: "cn-drive-f5fe0.appspot.com",
    messagingSenderId: "697516439550",
    appId: "1:697516439550:web:a5817a6e4439747a5ff2af",
    measurementId: "G-HFCGMWE7GC"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);
const database = getDatabase();
const storage = getStorage();

// Firebase functions
//// Realtime database
const writeData = (loc, data, func) => {
    update(ref(database, loc), data)
    .then(() => {
        func(data);
    })
    .catch((error) => {
        console.error("Error writing data:", error);
    });
};
const readData = async (loc, func) => {
    try {
        const snapshot = await get(child(ref(database), loc));
        if (snapshot.exists()) {
            func(snapshot.val());
        } else {
            func([]);
        }
    } catch (error) {
        console.error("Error reading data:", error);
    }
};
const deleteData = (loc, func) => {
    remove(ref(database, loc))
    .then(() => {
        func();
    })
    .catch((error) => {
        console.error("Error deleting user:", error);
    });
};
const onUpdate = (loc, func) => {
    onValue(ref(database, loc), (snapshot) => {
        const data = snapshot.val();
        func(data);
    });
};
//// Cloud Storage
function uploadFile(file, path, func) {
    const uploadTask = uploadBytesResumable(stRef(storage, path), file);
    uploadTask.on(
        "state_changed",
        (snapshot) => {
            const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
            func("Progress", [progress, snapshot.state]);
        },
        (error) => {
            console.error("Error uploading file:", error);
        },
        () => {
            getDownloadURL(uploadTask.snapshot.ref).then((downloadURL) => {
                func("Complete", downloadURL);
            });
        }
    );      
}
function deleteFile(path, func) {
    deleteObject(stRef(storage, path)).then(() => {
        func();
    }).catch((error) => {
        console.error("Error deleting file:", error);
    });
}

// Global Variables
let navMode = "Drive";
let locationStr = "Drive";
let data = {};

// Functions
function byte2KB(b) {
    return (b / 1024).toFixed(2);
}
function byte2MB(b) {
    return (b / (1024 * 1024)).toFixed(2);
}
function byte2GB(b) {
    return (b / (1024 * 1024 * 1024)).toFixed(2);
}
function removeFileExtension(filename) {
    let lastDotIndex = filename.lastIndexOf(".");
    return lastDotIndex === -1 ? filename : filename.substring(0, lastDotIndex);
}
function snackbar(text, duration) {
    document.getElementById("snackbar").hidden = false;
    document.getElementById("snackbar").innerHTML = text;
    if (duration > 0) {
        setTimeout(function() {
            document.getElementById("snackbar").hidden = true;
        }, duration);
    }
}
function customMenuAction(action, path) {
    let keys = path.split("/")
    let tempData = keys.reduce((acc, key) => acc[key], data);
    let ts = path.split("/").pop().slice(2);
    if (action == "Copy Link") {
        navigator.clipboard.writeText(tempData["url"])
        .then(() => {
            snackbar("Successfully Copied", 3000);
        })
        .catch((err) => {
            console.error("Failed to copy text: ", err);
            snackbar("Failed to copy", 3000);
        });
    } else if (action == "Rename") {
        let filename = prompt("Enter a new name for the file:");
        if (filename.trim() != "") {
            let dat = tempData;
            dat["name"] = filename;
            writeData(path, dat, function() {
                snackbar("Successfully Renamed", 3000);
            })
        } else {
            snackbar("Invalid filename", 3000);
        }
    } else if (action == "Delete") {
        let conf = confirm("Are you sure? This cannot be undone.");
        if (conf == true) {
            deleteFile(ts+"/", function() {
                deleteData(path, function() {
                    snackbar("Successfully Deleted", 3000);
                })
            });
        }
    } else if (action == "About") {
        alert(`Name: ${tempData["name"]}
Size: ${tempData["size"]} Bytes
Uploaded Timestamp: ${ts}`)
    }
}
function refreshScreen(loc) {
    fileList.innerHTML = "";
    try {
        let keys = loc.split('/');
        if (keys.reduce((acc, key) => acc[key], data) != undefined) {
            for (let o of Object.keys(keys.reduce((acc, key) => acc[key], data))) {
                let fileInfo = [o.slice(0, 2), o.slice(2)]; // Split the data into type and name
                let newFile = document.createElement("div");
                newFile.className = "file-item";
                if (fileInfo[0] == "00") {
                    newFile.innerHTML = `📁 ${fileInfo[1]}`;
                    newFile.onclick = function() {
                        locationStr += `/${o}`;
                        refreshScreen(locationStr);
                    }
                } else if (fileInfo[0] == "01") {
                    if (locationStr.split("/")[0] == "Drive") {
                        newFile.innerHTML = `📄 ${keys.reduce((acc, key) => acc[key], data)[o]["name"]}`;
                        newFile.setAttribute("path", `${locationStr}/${o}`);
                        newFile.onclick = function() {
                            window.open(keys.reduce((acc, key) => acc[key], data)[o]["url"], "_blank");
                        }
                        newFile.oncontextmenu = function(e) {
                            e.preventDefault();  // Prevent default menu
                            customMenu.style.top = `${e.clientY}px`;
                            customMenu.style.left = `${e.clientX}px`;
                            customMenu.style.display = 'block';
                            customMenu.innerHTML = "";
                            let arr = [];
                            if (navMode == "Drive") {
                                arr = ["Copy Link", "Rename", "Delete", "About"];
                            } else if (navMode = "Notes") {
                                arr = ["Copy", "Edit", "Delete"];
                            }
                            for (let x of arr) {
                                let li = document.createElement("li");
                                li.innerHTML = x;
                                li.onclick = function() {
                                    customMenuAction(x, e.target.getAttribute("path"));
                                }
                                customMenu.appendChild(li);
                            }
                        };
                    } else if (locationStr.split("/")[0] == "Notes") {
                        newFile.innerHTML = `📄 ${keys.reduce((acc, key) => acc[key], data)[o]["name"]}`;
                        newFile.onclick = function() {
                            alert(`${keys.reduce((acc, key) => acc[key], data)[o]["name"]}\n\n${keys.reduce((acc, key) => acc[key], data)[o]["note"]}`)
                        }
                    }
                }
                fileList.appendChild(newFile);
            }
        } else {    
            fileList.innerHTML = "It's Empty Here";
        }
    }
    catch {
        fileList.innerHTML = "It's Empty Here";
    }
    if (locationStr == "Drive" || locationStr == "Notes") {
        backBtn.hidden = true;
    } else {
        backBtn.hidden = false;
    }
    let locSplit = locationStr.split("/");
    let displayStr = "";
    for (let y of locSplit) {
        if (locSplit.indexOf(y) != 0) {
            displayStr += "/";
            displayStr += y.slice(2);
        } else {
            displayStr += locSplit[0];
        }
    }
    contentHeader.innerHTML = displayStr;
}

// Navigate
navDrive.onclick = function() {
    navMode = "Drive";
    locationStr = "Drive";
    this.style.backgroundColor = "grey";
    navNote.style.removeProperty('background-color');
    contentHeader.innerHTML = "Drive";
    noteBtn.hidden = true;
    uploadBtn.hidden = false;
    refreshScreen(locationStr);
}
navNote.onclick = function() {
    navMode = "Notes";
    locationStr = "Notes";
    this.style.backgroundColor = "grey";
    navDrive.style.removeProperty('background-color');
    contentHeader.innerHTML = "Notes";
    noteBtn.hidden = false;
    uploadBtn.hidden = true;
    refreshScreen(locationStr);
}
backBtn.onclick = function() {
    locationStr = locationStr.substring(0, locationStr.lastIndexOf('/'));
    refreshScreen(locationStr);
}

// User Interface
folderBtn.onclick = function() { // New Folder
    let folderName = prompt("Enter new folder name");
    if (folderName != null & folderName.trim() != "") {
        if (folderName.trim() != "") {
            locationStr = `${locationStr}/00${folderName}`;
            refreshScreen(locationStr);
        }
    }
}
uploadInput.oninput = function() { // Upload file
    let file = this.files[0];
    let timestamp = Date.now();
    const size = file.size;
    let displaySize = size;
    let unit = "";
    if (size > 1024**3) {
        unit = "GB";
        displaySize = byte2GB(displaySize);
    } else if (size <= 1024) {
        unit = "B";
    } else if (size <= 1024**2) {
        unit = "KB";
        displaySize = byte2KB(displaySize);
    } else if (size <= 1024**3) {
        unit = "MB";
        displaySize = byte2MB(displaySize);
    }
    uploadFile(file, timestamp+"/", function(type, dat) {
        if (type == "Progress") {
            const progress = dat[0];
            let tempSize = size * (progress / 100);
            let tempUnit = "";
            if (tempSize > 1024**3) {
                tempUnit = "GB";
                tempSize = byte2GB(tempSize);
            } else if (tempSize <= 1024) {
                tempUnit = "B";
            } else if (tempSize <= 1024**2) {
                tempUnit = "KB";
                tempSize = byte2KB(tempSize);
            } else if (tempSize <= 1024**3) {
                tempUnit = "MB";
                tempSize = byte2MB(tempSize);
            }
            snackbar(`Upload progress: ${tempSize}${tempUnit}/${displaySize}${unit} (${Number(progress.toFixed(2))}%)`, 0);
            switch (dat[1]) {
                case "paused":
                break;
                case "running":
                break;
            }
        } else if (type == "Complete") {
            writeData(locationStr + "/01" + timestamp, {"name": file.name, "size": file.size, "url": dat}, function() {
                snackbar("Successfully Uploaded", 3000);
            })
        }
    })
}
noteBtn.onclick = function() {
    let title = prompt("Title");
    let inp = prompt("Your Note Here");
    let timestamp = Date.now();
    writeData(locationStr + "/01" + timestamp, {"name": title, "note": inp}, function() {
    })
}

// Hide the context menu
document.addEventListener('click', () => {
    customMenu.style.display = 'none';
});

// Menu
document.getElementById('menuToggle').onclick = function() {
    document.getElementById('sidebar').classList.toggle('show');
};
document.onclick = function() {
    let sidebar = document.getElementById('sidebar');
    let menuToggle = document.getElementById('menuToggle');
    if (!sidebar.contains(e.target) && !menuToggle.contains(e.target)) {
        sidebar.classList.remove('show');
    }
};

// Firebase Update Listener
onUpdate("/", function(dat) {
    data = dat;
    // Refresh the screen
    if (dat != null) {
        if (navMode == "Drive") {
            if (data["Drive"] != undefined) {
                refreshScreen(locationStr);
            } else {
                fileList.innerHTML = "It's Empty Here";
            }
        } else if (navMode == "Notes") {
            if (data["Notes"] != undefined) {
                refreshScreen(locationStr);
            } else {
                fileList.innerHTML = "It's Empty Here";
            }
        }
    } else {
        data = {};
        refreshScreen();
    }
})