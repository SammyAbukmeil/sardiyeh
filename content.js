// Main script that works on chrome pages

(() => {
  // Function to get dictionary from local storage
  function getDictionaryFromLocalStorage() {
    const dictionary = localStorage.getItem("dictionary");
    const timestamp = localStorage.getItem("dictionaryTimestamp");
    if (dictionary && timestamp) {
      return {
        data: JSON.parse(dictionary),
        timestamp: new Date(timestamp),
      };
    }
    return null;
  }

  // Function to save dictionary to local storage
  function saveDictionaryToLocalStorage(dictionary) {
    const timestamp = new Date();
    localStorage.setItem("dictionary", JSON.stringify(dictionary));
    localStorage.setItem("dictionaryTimestamp", timestamp.toISOString());
  }

  // Function to check if a week has passed since the last update
  function isWeekPassed(timestamp) {
    const now = new Date();
    const weekInMilliseconds = 7 * 24 * 60 * 60 * 1000;
    return now - timestamp > weekInMilliseconds;
  }

  // Main function to get dictionary
  async function getDictionary() {
    let dictionaryData = getDictionaryFromLocalStorage();
    if (dictionaryData && !isWeekPassed(dictionaryData.timestamp)) {
      return dictionaryData.data;
    } else {
      return await fetchDictionary();
    }
  }

  async function fetchDictionary() {
    try {
      response = await fetch(
        "https://api.jsonbin.io/v3/b/669bb785e41b4d34e41497e4",
        {
          method: "GET",
          headers: {
            "X-Access-Key":
              "$2a$10$D40ON/o9o/wDGqEu281T5e/t.DQ8NipDJAXRYc/conOeNaUuvxIRS",
          },
        }
      );

      data = await response.json();

      console.log("data is ", data);

      const dictionary = data["record"];

      if (dictionary == null || typeof dictionary === "undefined") {
        textToChange = false;
        return;
      }

      await chrome.storage.sync.set({ dictionary: dictionary }, () => {});
      await chrome.storage.local.set({ dictionary: dictionary });

      saveDictionaryToLocalStorage(dictionary);
      return dictionary;
    } catch (error) {
      console.error("Error fetching dictionary:", error);
    }
  }

  let textToChange;
  let regex;

  const replacedWords = [];
  const replacedSet = new Set();

  const getReplacementText = (text) => {
    let replacement = textToChange[text.toLowerCase()];
    if (!replacement) {
      return text;
    }
    if (text.charAt(0) === text.charAt(0).toUpperCase()) {
      replacement = replacement.charAt(0).toUpperCase() + replacement.slice(1);
    }
    return replacement;
  };

  const replaceText = (el) => {
    if (el.nodeType === Node.TEXT_NODE) {
      if (regex.test(el.textContent)) {
        createTooltip(el);

        el.textContent = el.textContent.replace(regex, (matched) => {
          const replacement = getReplacementText(matched);
          if (
            replacement !== matched &&
            !replacedSet.has(matched.toLowerCase())
          ) {
            replacedWords.push({ original: matched, replacement: replacement });
            replacedSet.add(matched.toLowerCase());
          }
          return replacement;
        });

      }
    } else {
      for (let child of el.childNodes) {
        replaceText(child);
        replaceText(child);
      }
    }
  };

  const anyChildOfBody = "/html/body//";
  // const doesNotContainAncestorWithRoleTextbox =
  //   "div[not(ancestor-or-self::*[@role=textbox])]/";
  const isTextButNotPartOfJsScriptOrTooltip = "text()[not(parent::script) and not(ancestor::*[contains(@class, 'tooltip')])]";
  const xpathExpression =
    anyChildOfBody +
    //  + doesNotContainAncestorWithRoleTextbox;
    isTextButNotPartOfJsScriptOrTooltip
    

  const replaceTextInNodes = () => {
    if (regex == null || typeof regex === "undefined") {
      return;
    }

    const result = document.evaluate(
      xpathExpression,
      document,
      null,
      XPathResult.ORDERED_NODE_SNAPSHOT_TYPE,
      null
    );
    console.log(result);
    for (let i = 0; i < result.snapshotLength; i++) {
      replaceText(result.snapshotItem(i));
    }
    chrome.storage.local.set({
      replacedWords: replacedWords,
      replacedSet: replacedSet,
    });
  };

  chrome.storage.sync.get(["ext_on"], async function (items) {
    if (chrome.runtime.lastError) {
      console.error(chrome.runtime.lastError);
      return;
    }

    if (items.ext_on === false) {
      return;
    }

    if (textToChange === false) {
      return;
    }

    if (textToChange == null || typeof textToChange === "undefined") {
      textToChange = await getDictionary();

      if (textToChange == null || typeof textToChange === "undefined") {
        return;
      }

      regex = new RegExp(
        "\\b(" + Object.keys(textToChange).join("|") + ")\\b",
        "gi"
      );
    }

    if (replacedWords.length > 0) {
      chrome.storage.local.set({
        replacedWords: replacedWords,
        replacedSet: replacedSet,
      });
    }

    let timeout;
    let lastRun = performance.now();

    const observer = new MutationObserver((mutations) => {
      const shouldUpdate = mutations.some((mutation) => {
        return mutation.type === "childList" && mutation.addedNodes.length > 0;
      });

      if (!shouldUpdate) {
        return;
      }

      if (performance.now() - lastRun < 3000) {
        clearTimeout(timeout);
        timeout = setTimeout(() => {
          replaceTextInNodes();
          lastRun = performance.now();
        }, 600);
      } else {
        replaceTextInNodes();

        lastRun = performance.now();
      }
    });

    observer.observe(document, {
      childList: true,
      subtree: true,
      attributes: false,
      characterData: false,
      characterDataOldValue: false,
    });
  });

  const createTooltip = (el) => {
    const newElement = document.createElement("div");

    newElement.innerText = el.textContent;
    newElement.classList.add("tooltip");
    newElement.style.position = "absolute";
    newElement.style.backgroundColor = "black";
    newElement.style.color = "white";
    newElement.style.padding = "5px";
    newElement.style.borderRadius = "5px";
    newElement.style.fontSize = "12px";
    newElement.style.visibility = "hidden";
    newElement.style.zIndex = "1000";

    document.body.appendChild(newElement);

    const parentNode = el.parentNode;

    parentNode.addEventListener("mouseenter", function () {
      const rect = parentNode.getBoundingClientRect(); // Get the element's position
      newElement.style.left = `${rect.left + window.scrollX}px`;
      newElement.style.top = `${rect.top + window.scrollY - newElement.offsetHeight}px`; 
      newElement.style.visibility = "visible";
    });

    parentNode.addEventListener("mouseleave", function () {
      newElement.style.visibility = "hidden";
    });
  }
})();
