import { GlossaryManager } from "../../logic/src/campaign/glossary/glossaryManager.js"
import { GlossaryCollectionService } from "../../logic/src/campaign/glossary/glossaryCollection.js"

// Builds a GlossaryManager containing the given en-us terms, for tests that need to resolve
// or list glossary entries without reading a real glossary.json off disk.
export const glossaryManagerWith = (
    terms: {
        termId: string
        type: string
        name: string
        definition: string
    }[]
): GlossaryManager => {
    const glossaryManager = new GlossaryManager(GlossaryCollectionService.new())
    glossaryManager.addTermsFromJson({
        terms: terms.map((term) => ({
            termId: term.termId,
            type: term.type,
            name: { "en-us": { text: term.name } },
            definition: { "en-us": { text: term.definition } },
        })),
    })
    return glossaryManager
}
