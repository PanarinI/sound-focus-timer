// ─────────────────────────────────────────────────────────────────────────
// СКРИПТ МАССОВОЙ ЗАГРУЗКИ ПОЛНЫХ ОПИСАНИЙ (FULL) В CWS
// Источник — канон буткемпа app-studio/knowledge-base/module-3/3.6.
// Читает storeDesc из каждого _locales/<code>/messages.json и раскладывает
// полное описание по всем языкам листинга ОДНИМ прогоном (иначе — 53 раза руками).
//
// КАК ЗАПУСКАТЬ (делает АВТОР в своём браузере, на своём CWS Dashboard):
//   1. CWS Dashboard → твоё расширение → вкладка "Store Listing". ОБНОВИТЬ страницу.
//   2. F12 → вкладка Console. Если Chrome ругается на вставку — напечатать: allow pasting
//   3. Вставить ВЕСЬ код ниже → Enter.
//   4. В зелёном окне сверху → Choose Files → выбрать папку:
//        sound-focus-timer/extension/_locales
//      (именно папку _locales — скрипт берёт код языка из пути "_locales/<code>/messages.json")
//   5. Подтвердить загрузку. Скрипт пройдёт все языки, заполнит FULL как «действия юзера».
//   6. Save draft → обновить страницу → проверить, переключая "Current editing language".
//
// Наши _locales уже содержат storeDesc (build-locales.py). he→iw подмена — в скрипте.
// ─────────────────────────────────────────────────────────────────────────

const ANIMATION_TIMEOUT = 500

const fileInput = document.createElement('input')
fileInput.setAttribute("id", "filepicker")
fileInput.setAttribute("type", 'file')
fileInput.setAttribute("webkitdirectory", '')
fileInput.setAttribute("multiple", '')
fileInput.setAttribute("style", 'position: absolute;top: 0;z-index: 999;padding: 1rem;background: green;')
document.documentElement.append(fileInput)

document.getElementById("filepicker").addEventListener(
    "change",
    async (event) => {
        const files = event.target.files

        const locales = {}

        const localeFiles = Object.values(files).filter(f => f.name == 'messages.json').filter(f => f.type == 'application/json')

        for (const localeFile of localeFiles) {
            const localeCode = localeFile.webkitRelativePath.replace('_locales/', '').replace('/messages.json', '')
            const fileText = await localeFile.text()

            const localeJson = JSON.parse(fileText)
            if (localeJson.storeDesc) {
                locales[localeCode] = localeJson.storeDesc.message
            } else {
                console.error(`[${localeCode}] - no store desc for this locale: ${fileText}`)
            }
        }

        console.log("all locales:", locales)

        await uploadLocales(locales)
    },
    false,);

function sleep(time) {
    return new Promise((resolve) => setTimeout(resolve, time));
}

async function uploadLocales(locales) {
    const dropdown = document.evaluate("//h3[text()='Current editing language']/../../div[2]//div[@jsshadow]/div/div", document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null).singleNodeValue

    for (const entry of Object.entries(locales)) {
        let code = entry[0].replace('_', '-')
        const description = entry[1]

        // Check and replace 'he' with 'iw'
        if (code === 'he') {
            code = 'iw'
        }

        console.log('upload locale:', code)

        dropdown.click()

        try {
            [...document.evaluate("//ul[@aria-label='Language']", document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null).singleNodeValue.children]
                .filter(e => e.tagName == 'LI')
                .filter(e => e.getAttribute('data-value') == code)[0]
                .click()
        } catch (e) {
            console.error("cant find locale with code - ", code)
            continue
        }
        await sleep(ANIMATION_TIMEOUT)

        const textarea = document.evaluate("//textarea[@maxlength='16000']", document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null).singleNodeValue
        textarea.dispatchEvent(new Event("focus"))
        textarea.value = description
        textarea.dispatchEvent(new Event('input', {
            bubbles: true,
        }))
        await sleep(ANIMATION_TIMEOUT)
    }
}
