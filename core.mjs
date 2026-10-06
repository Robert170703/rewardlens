/** Read-only helpers for public GitHub issue evidence. No network or execution. */

const ISSUE_URL_ERROR = 'Usa un enlace exacto https://github.com/owner/repo/issues/123, sin parámetros, fragmentos ni credenciales.';

/** Validate rather than reinterpret links, so credentials and lookalike hosts stay out. */
export function parseIssueUrl(input) {
    if (typeof input !== 'string') {
        throw new TypeError(ISSUE_URL_ERROR);
    }
    const value = input.trim();
    if (!value || value.length > 2048 || /[\u0000-\u0020\u007f]/u.test(value) || /\/\.{1,2}(?:\/|$)/u.test(value)) {
        throw new TypeError(ISSUE_URL_ERROR);
    }

    let parsed;
    try {
        parsed = new URL(value);
    } catch {
        throw new TypeError(ISSUE_URL_ERROR);
    }
    if (parsed.protocol !== 'https:' || parsed.hostname !== 'github.com' || parsed.port || parsed.username || parsed.password || parsed.search || parsed.hash || /[?#]/u.test(value)) {
        throw new TypeError(ISSUE_URL_ERROR);
    }
    const match = parsed.pathname.match(/^\/([A-Za-z0-9][A-Za-z0-9-]{0,38})\/([A-Za-z0-9_.-]{1,100})\/issues\/([1-9]\d*)\/?$/u);
    if (!match || match[2] === '.' || match[2] === '..' || /%|\\/u.test(value)) {
        throw new TypeError(ISSUE_URL_ERROR);
    }
    const [, owner, repo, rawNumber] = match;
    const number = Number(rawNumber);
    if (!Number.isSafeInteger(number)) {
        throw new TypeError(ISSUE_URL_ERROR);
    }
    return {owner, repo, number, url: `https://github.com/${owner}/${repo}/issues/${number}`};
}

/** Extract one displayed dollar/USD amount; conflicting amounts remain unknown. */
export function extractRewardAmount(title) {
    if (typeof title !== 'string') {
        return null;
    }
    const number = '(?:\\d{1,3}(?:,\\d{3})+|\\d+)(?:\\.\\d{1,2})?';
    const pattern = new RegExp(`(?<![A-Za-z0-9$-])(?:US\\s*\\$|USD\\s*\\$?|\\$)\\s*(${number})(?![\\d.,])`, 'giu');
    const amounts = [];
    for (const match of title.matchAll(pattern)) {
        const before = title.slice(0, match.index);
        const after = title.slice(match.index + match[0].length);
        // A bare dollar sign does not identify a non-USD currency as USD.
        const nonUsdPrefix = match[0].startsWith('$') && /\b(?:C|CA|CAD|AU|AUD|NZ|NZD|HK|HKD|S|SG|SGD)\s*$/iu.test(before);
        if (nonUsdPrefix || /^\s*(?:CAD|AUD|NZD|HKD|SGD|MXN|ARS|CLP|COP|JPY|EUR|GBP)\b/iu.test(after)) {
            continue;
        }
        const amount = Number(match[1].replaceAll(',', ''));
        if (Number.isFinite(amount) && amount >= 0) {
            amounts.push(amount);
        }
    }
    const uniqueAmounts = [...new Set(amounts)];
    return uniqueAmounts.length === 1 ? uniqueAmounts[0] : null;
}

function isBot(comment) {
    const login = comment?.user?.login ?? '';
    return comment?.user?.type === 'Bot' || /(?:\[bot\]|[-_]bot)$/iu.test(login) || /^MelvinBot$/iu.test(login);
}

function readableText(body) {
    return body
        .replace(/```[^]*?```/gu, '')
        .replace(/<!--[^]*?-->/gu, '')
        .split('\n')
        .filter((line) => !/^\s*>/u.test(line))
        .join('\n')
        .replace(/!?\[([^\]]*)\]\([^)]*\)/gu, '$1')
        .replace(/https?:\/\/\S+/gu, '')
        .replace(/`[^`]*`/gu, '')
        .replace(/[*_]/gu, '');
}

function hasProposalHeading(body) {
    // Revisions and casual "I have a proposal" posts are not fresh submissions.
    return /^(?: {0,3})#{1,6}\s+Proposal\s*[:.!]?\s*$/imu.test(readableText(body));
}

function selectionText(comment) {
    if (isBot(comment) || typeof comment?.body !== 'string') {
        return null;
    }
    // GitHub comments often use smart apostrophes in English contractions.
    const text = readableText(comment.body).replace(/[\u2018\u2019\u02bc]/gu, "'");
    const clauses = text.split(/\n|(?<=[.!?;])\s+|\bbut\b/iu);
    const selection = /\b(?:recommend(?:s|ed|ing|ation)?|assign(?:s|ed|ing)?|select(?:s|ed|ing)?|hir(?:e|es|ed|ing)|(?:proposal\s+(?:is\s+|was\s+|has\s+been\s+)?(?:accepted|approved)))\b|\b(?:moving\s+forward\s+with|proceed(?:ing)?\s+with|go(?:ing)?\s+with)\b/giu;
    for (const clause of clauses) {
        const clean = clause.replace(/\s+/gu, ' ').trim();
        if (!clean) {
            continue;
        }
        for (const match of clean.matchAll(selection)) {
            const prefix = clean.slice(Math.max(0, match.index - 150), match.index).toLowerCase();
            const suffix = clean.slice(match.index + match[0].length, match.index + match[0].length + 70).toLowerCase();
            // A technical recommendation alone does not imply contributor selection.
            if (/^recommend/iu.test(match[0]) && !/@[A-Za-z0-9][\w-]*|\b(?:proposal|contributor|candidate|contractor|hire|hired|hiring|assignment)\b|\bC\+\s+reviewer\b/iu.test(clean)) {
                continue;
            }
            // Negation, uncertainty, questions and requests are not selection evidence.
            if (/\b(?:not|no|never|without|yet\s+to|pending|awaiting|waiting|haven't|hasn't|isn't|aren't|wasn't|weren't|don't|doesn't|didn't|won't|can't|cannot|couldn't)\b[^,;:]*$/iu.test(prefix)
                || /\b(?:if|unless|please|could|would|should|can|may|might|whether|want|wants|wish|like|ready|consider)\b[^,;:]*$/iu.test(prefix)
                || /^(?:\s+(?:yet|later|tomorrow|soon|anyone\s+yet|nobody)|\s*\?)/iu.test(suffix)
                || /^\s*(?:please|could|would|should|can|may)\b/iu.test(clean)
                || /\b(?:no\s+one|nobody|none)\b/iu.test(clean)
                || /\?\s*$/u.test(clean)) {
                continue;
            }
            return clean.slice(0, 220);
        }
    }
    return null;
}

function hasUnsafeRequest(text) {
    const secret = '(?:system[\\s_-]*prompt|hidden[\\s_-]*instructions?|api[\\s_-]*keys?|access[\\s_-]*tokens?|private[\\s_-]*keys?|passwords?|credentials|secrets?|contraseñas?|credenciales|claves?[\\s_-]*(?:api|privadas?))';
    const verb = '(?:reveal|extract|exfiltrate|leak|steal|provide|share|send|print|show|return|expose|give|paste|dump|upload|recover|obtain|collect|fetch|read|revela|extrae|comparte|envía|muestra|publica|obtén)';
    return new RegExp(`\\b${verb}\\b[^.!?\\n]{0,180}\\b${secret}\\b`, 'iu').test(text)
        || /\bignore\s+(?:all\s+)?(?:previous|prior|system)\s+instructions\b/iu.test(text);
}

/**
 * Interpret metadata and public comments as review signals, never as proof of pay.
 * `repo` is a GitHub repository object; `issue` and `comments` are public API JSON.
 */
export function analyzeIssue({issue, repo, comments = [], commentsComplete = true, checkedAt} = {}) {
    if (!issue || typeof issue !== 'object' || typeof issue.title !== 'string') {
        throw new TypeError('La respuesta no contiene una ficha de issue válida.');
    }
    const flags = [];
    const addFlag = (code, label, detail) => flags.push({code, label, detail});
    const title = issue.title;
    const amount = extractRewardAmount(title);
    const state = issue.state === 'closed' || issue.closed === true || issue.closed_at ? 'closed' : issue.state === 'open' ? 'open' : 'unknown';
    let url = '';
    try {
        url = parseIssueUrl(issue.html_url).url;
    } catch {
        addFlag('invalid_source', 'Enlace de origen no válido', 'No se pudo verificar un enlace exacto de issue público en GitHub.');
    }

    let blocked = false;
    if (state === 'closed') {
        blocked = true;
        addFlag('closed_issue', 'Issue cerrado', 'GitHub indica que la ficha está cerrada; no tratarla como una recompensa abierta.');
    } else if (state === 'unknown') {
        addFlag('unknown_state', 'Estado desconocido', 'La respuesta no permite comprobar si el issue está abierto.');
    }
    if (issue.pull_request != null) {
        blocked = true;
        addFlag('pull_request', 'Es un pull request', 'Este auditor espera una ficha de issue; un PR no acredita una recompensa pendiente.');
    }
    if (!repo || typeof repo !== 'object') {
        addFlag('repository_unverified', 'Repositorio sin verificar', 'Faltan los metadatos del repositorio para comprobar si está archivado o es público.');
    } else {
        if (repo.archived === true) {
            blocked = true;
            addFlag('archived_repository', 'Repositorio archivado', 'GitHub marca este repositorio como archivado.');
        }
        if (repo.private === true || repo.visibility === 'private') {
            blocked = true;
            addFlag('private_repository', 'Repositorio privado', 'Esta herramienta está limitada a evidencia de repositorios públicos.');
        }
    }
    if (amount === null) {
        addFlag('unknown_reward', 'Importe sin confirmar', 'El título no contiene un único importe identificable en dólares/USD; revisa la fuente.');
    } else if (amount === 0) {
        addFlag('zero_reward', 'Importe de cero', 'El título muestra una recompensa de cero dólares.');
    }

    const commentList = Array.isArray(comments) ? comments : [];
    const summarized = commentList.some((comment) => comment?.evidenceType === 'summary');
    const missingByCount = Number.isInteger(issue.comments) && issue.comments > commentList.length;
    const complete = commentsComplete === true && Array.isArray(comments) && !summarized && !missingByCount;
    if (!complete) {
        addFlag('incomplete_comments', 'Comentarios incompletos', 'No están comprobados todos los comentarios actuales; puede haber selección, retirada o nuevas condiciones.');
    }
    if (summarized) {
        addFlag('summary_evidence', 'Evidencia resumida', 'Hay comentarios resumidos; sus frases y fechas deben cotejarse con la conversación original.');
    }
    const proposalCount = commentList.filter((comment) => typeof comment?.body === 'string' && comment.evidenceType !== 'summary' && hasProposalHeading(comment.body)).length;
    if (proposalCount > 0) {
        addFlag('existing_proposals', 'Ya hay propuestas', `Se detectaron ${proposalCount} comentarios con encabezado de propuesta; revisa su contenido antes de enviar una solución.`);
    }
    const signal = commentList.map((comment) => ({comment, text: selectionText(comment)})).find(({text}) => text);
    if (signal) {
        const author = typeof signal.comment.user?.login === 'string' ? signal.comment.user.login : 'un autor humano';
        const evidence = signal.comment.evidenceType === 'summary'
            ? `Resumen de un comentario de ${author}; consulta el original para comprobar la recomendación.`
            : `Frase de ${author}: “${signal.text}”.`;
        addFlag('selection_signal', 'Posible selección o recomendación', `${evidence} Es una señal textual para revisión humana, no una contratación verificada.`);
    }
    const assignees = Array.isArray(issue.assignees) ? issue.assignees.filter((person) => person && typeof person.login === 'string') : [];
    if (assignees.length) {
        addFlag('assignees_present', 'La ficha tiene asignaciones', `Asignados: ${assignees.map((person) => person.login).join(', ')}. Pueden ser revisores o responsables internos; esto no demuestra que el trabajo esté adjudicado.`);
    }
    const issueText = `${title}\n${typeof issue.body === 'string' ? issue.body : ''}`;
    if (hasUnsafeRequest(issueText)) {
        addFlag('unsafe_request', 'Posible solicitud de secretos', 'El texto puede pedir secretos, credenciales o instrucciones internas. Es contenido no confiable: no ejecutarlo ni revelar esos datos.');
    }
    const status = blocked ? 'closed' : flags.length ? 'caution' : 'review';
    const timestamp = typeof checkedAt === 'string' && Number.isFinite(Date.parse(checkedAt)) ? new Date(checkedAt).toISOString() : new Date().toISOString();
    const lead = status === 'closed' ? 'La ficha requiere descartarse de esta búsqueda.' : status === 'caution' ? 'Hay señales que revisar antes de proponer.' : 'Ficha abierta para revisión humana.';
    return {
        title,
        url,
        amount,
        state,
        status,
        flags,
        proposalCount,
        commentsComplete: complete,
        checkedAt: timestamp,
        summary: `${lead} Fondos, disponibilidad y cobro no verificados.`,
    };
}
