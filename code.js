import { initializeApp } from "https://www.gstatic.com/firebasejs/11.0.1/firebase-app.js";
import { getAnalytics } from "https://www.gstatic.com/firebasejs/11.0.1/firebase-analytics.js";
import { getDatabase, ref, get, child, update, remove, onValue } from "https://www.gstatic.com/firebasejs/11.0.1/firebase-database.js";
import { getStorage, ref as stRef, deleteObject, getDownloadURL, uploadBytesResumable, updateMetadata } from "https://www.gstatic.com/firebasejs/11.0.1/firebase-storage.js";

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
    // Create a metadata object with the desired filename
    const metadata = {
        contentDisposition: `attachment; filename="${file.name}"` // This sets the filename to the original file name
    };

    // Upload the file with the metadata
    const uploadTask = uploadBytesResumable(stRef(storage, path), file, metadata);

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
function updateFileMetadata(filePath, newMetadata, func) {
    // Reference to the file in Firebase Storage
    const fileRef = stRef(storage, filePath);

    // Update the metadata
    updateMetadata(fileRef, newMetadata)
        .then((updatedMetadata) => {
            func("Metadata Updated", updatedMetadata);
        })
        .catch((error) => {
            console.error("Error updating metadata:", error);
            func("Error", error);
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
function showSnackbar(text, duration) {
    snackbar.hidden = false;
    snackbar.innerHTML = text;
    if (duration > 0) {
        setTimeout(function() {
            snackbar.hidden = true;
        }, duration);
    }
}
function getFileExtension(filename) {
    // Split the filename by dot and get the last part
    const parts = filename.split('.');
    // Return the last part (extension), or an empty string if no extension is found
    return parts.length > 1 ? parts[parts.length - 1].toLowerCase() : '';
}
function customMenuAction(action, path) {
    let keys = path.split("/");
    let tempData = keys.reduce((acc, key) => acc[key], data);
    let ts = path.split("/").pop().slice(2);
    if (action == "Copy Link") {
        navigator.clipboard.writeText(tempData["url"])
        .then(() => {
            showSnackbar("Successfully Copied", 3000);
        })
        .catch((err) => {
            console.error("Failed to copy text: ", err);
            showSnackbar("Failed to copy", 3000);
        });
    } else if (action == "Rename") {
        askPrompt("Enter a new name for the file:", tempData["name"], function(filename) {
            if (filename != null && filename.trim() != "") {
                let conf = true;
                if (getFileExtension(filename) != getFileExtension(tempData["name"])) {
                    conf = confirm("Are you sure you want to change the file extension?");
                }
                if (conf == true) {
                    let dat = tempData;
                    dat["name"] = filename;
                    // METADATA
                    updateFileMetadata(ts+"/", {contentDisposition: `attachment; filename="${filename}"`}, (status, result) => {
                        writeData(path, dat, function() {
                            showSnackbar("Successfully Renamed", 3000);
                        })
                    });
                }
            } else {
                if (filename != null) {
                    showSnackbar("Invalid filename", 3000);
                }
            }
        })
    } else if (action == "Delete") {
        let conf = confirm("Are you sure? This cannot be undone.");
        if (conf == true) {
            deleteFile(ts+"/", function() {
                deleteData(path, function() {
                    showSnackbar("Successfully Deleted", 3000);
                })
            });
        }
    } else if (action == "About") {
        alert(`Name: ${tempData["name"]}
Size: ${tempData["size"]} Bytes
Uploaded Timestamp: ${ts}`)
    } else if (action == "Download") {
        let a = document.createElement("a");
        a.href = `${tempData["url"]}?cache_bust=${new Date().getTime()}`;
        a.download = tempData["name"];
        a.target = "_blank";
        a.click();
    }
}
function askPrompt(txt, def, func) {
    let barrier = document.createElement("div");
    barrier.className = "barrier";
    document.body.appendChild(barrier);
    let div = document.createElement("div");
    div.id = "customPrompt";
    barrier.appendChild(div);
    let span = document.createElement("span");
    span.id = "promptSpan";
    span.innerHTML = txt;
    div.appendChild(span);
    let input = document.createElement("input");
    input.id = "promptInput";
    input.value = def;
    div.appendChild(input);
    let cancel = document.createElement("button");
    cancel.id = "promptCancel";
    cancel.innerHTML = "Cancel";
    cancel.className = "promptBtn";
    div.appendChild(cancel);
    let ok = document.createElement("button");
    ok.id = "promptOk";
    ok.innerHTML = "OK";
    ok.className = "promptBtn";
    div.appendChild(ok);
    ok.onclick = function() {
        barrier.remove();
        func(input.value);
    }
    cancel.onclick = function() {
        barrier.remove()
        func(null);
    }
    input.focus();
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
                    newFile.innerHTML = `<span class='icon'>📁</span><span class='text'>${fileInfo[1]}</span>`;
                    newFile.onclick = function() {
                        locationStr += `/${o}`;
                        refreshScreen(locationStr);
                    }
                } else if (fileInfo[0] == "01") {
                    if (locationStr.split("/")[0] == "Drive") {
                        newFile.innerHTML = `<span class='icon'>📄</span><span class='text'>${keys.reduce((acc, key) => acc[key], data)[o]["name"]}</span>`;
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
                                arr = ["Copy Link", "Download", "Rename", "Delete", "About"];
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
    sidebar.classList.remove('show');
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
    sidebar.classList.remove('show');
}
backBtn.onclick = function() {
    locationStr = locationStr.substring(0, locationStr.lastIndexOf('/'));
    refreshScreen(locationStr);
}

// User Interface
folderBtn.onclick = function() { // New Folder
    sidebar.classList.remove('show');
    askPrompt("Folder Name?", "New Folder", function(folderName) {
        if (folderName != null && folderName.trim() != "") {
            locationStr = `${locationStr}/00${folderName}`;
            refreshScreen(locationStr);
        } else {
            if (folderName != null) {
                showSnackbar("Invalid Folder name", 3000);
            }
        }
    });
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
    uploadFile(file, timestamp + "/", function(type, dat) {
    // uploadFile(file, locationStr + "/" + file.name, function(type, dat) {
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
            showSnackbar(`Upload progress: ${tempSize}${tempUnit}/${displaySize}${unit} (${Number(progress.toFixed(2))}%)`, 0);
            switch (dat[1]) {
                case "paused":
                break;
                case "running":
                break;
            }
        } else if (type == "Complete") {
            writeData(locationStr + "/01" + timestamp, {"name": file.name, "size": file.size, "url": dat}, function() {
                showSnackbar("Successfully Uploaded", 3000);
            })
        }
    })
}
noteBtn.onclick = function() {
    sidebar.classList.remove('show');
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
toggleMenu.onclick = function() {
    sidebar.classList.toggle('show');
};
document.onclick = function(e) {
    if (!sidebar.contains(e.target) && !toggleMenu.contains(e.target)) {
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