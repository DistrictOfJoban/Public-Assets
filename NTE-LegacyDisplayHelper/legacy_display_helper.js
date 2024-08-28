importPackage(java.awt);
importPackage(java.awt.geom);
include(Resources.id("mtrsteamloco:scripts/display_helper.js"));

const displayCfg = parseDisplayFile(displayFile);
const mapImage = Resources.readBufferedImage(Resources.id(displayCfg.texFile));

const SerifFont = Resources.getSystemFont("Noto Serif");
const actualTexWidth = mapImage.getWidth();
const actualTexHeight = mapImage.getHeight();
const fullTexWidth = displayCfg.texWidth;
const fullTexHeight = displayCfg.texHeight;

if(typeof debug !== 'undefined') {
    debug = true;
} else {
    debug = false;
}

let slotCfg = parseSlotFile(slotsFile);
var dhBase = new DisplayHelper(slotCfg);

function createTrain(ctx, state, train) {
    state.dhLD = dhBase.create();
    state.refreshRateLD = new RateLimit(0.15);
}

function disposeTrain(ctx, state, train) {
    state.dhLD.close();
}

function renderTrain(ctx, state, train) {
    if(state.refreshRateLD.shouldUpdate() && train.shouldRender() && train.shouldRenderDetail()) {
        if(Timing.elapsed() % 0.3 >= 0.15) {
            state.dhLD.upload();
        } else {
            let vars = getVariableList(train);
            renderLogic(train, state.dhLD, vars, displayCfg.logics);
        }
    }
    
    for (let i = 0; i < train.trainCars(); i++) {
        ctx.drawCarModel(state.dhLD.model, i, null);
    }
}

function getSlots(id) {
    let grp = slotCfg.slot_groups[id];
    if(grp != null) {
        return grp;
    } else {
        return [id];
    }
}

function parseSlotFile(id) {
    let slotsText = Resources.readString(Resources.id(id));
    let slotsObj = JSON.parse(slotsText);
    
    let finalSlot = {
        "version": 1,
        "texSize": [screenWidth, screenHeight * slotsObj.slots.length],
        "slots": slotsObj.slots,
        "slot_groups": slotsObj.slot_groups
    }
    
    for(let i = 0; i < slotsObj.slots.length; i++) {
        finalSlot.slots[i].texArea = [0, screenHeight * i, screenWidth, screenHeight];
    }
    
    return finalSlot;
}

function parseDisplayFile(id) {
    print("[NTE Script] Parsing Legacy Display in " + id)
    const displayText = Resources.readString(Resources.id(id));
    const displayObj = JSON.parse(displayText);
    const rootPath = id.split("/").slice(0, -1).join("/") + "/";
    
    const routeMapTemplates = new Map();
    for(let [k, v] of Object.entries(displayObj.templates)) {
        routeMapTemplates.set(k, parseLogic(v, routeMapTemplates, rootPath));
    }
    
    const logics = parseLogic(displayObj.logic, routeMapTemplates, rootPath);
    return {
        texFile: rootPath + displayObj.texture,
        texWidth: displayObj.texture_size[0],
        texHeight: displayObj.texture_size[1],
        logics: logics
    }
}

function parseLogic(obj, rtMapTemplates, path) {
    if(!path) path = "";
    if(obj.class == "sequence") {
        for(let i = 0; i < obj.nodes.length; i++) {
            obj.nodes[i] = parseLogic(obj.nodes[i], rtMapTemplates, path);
        }
    }
    
    if(obj.class == "draw_line_map") {
        let template = obj.template;
        let rtMapTemplate = rtMapTemplates.get(obj.template);
        obj.template = rtMapTemplate;
    }
    
    if(obj.class == "cycle") {
        let offsets = [];
        let offset = 0;
        for(let i = 0; i < obj.nodes.length; i++) {
            obj.nodes[i] = parseLogic(obj.nodes[i], rtMapTemplates, path);
            
            offset += obj.nodes[i].duration;
            offsets.push(offset);
        }
        
        obj.totalDuration = offset;
        obj.offsets = offsets;
    }
    
    if(obj.class == "if" || obj.class == "switch") {
        for(let node of obj.nodes) {
            if(node.when.includes("<=")) {
                node.lhs = node.when.split("<=")[0].trim();
                node.rhs = node.when.split("<=")[1].trim();
                node.operator = "<=";
            } else if(node.when.includes(">=")) {
                node.lhs = node.when.split(">=")[0].trim();
                node.rhs = node.when.split(">=")[1].trim();
                node.operator = ">=";
            } else if(node.when.includes("==")) {
                node.lhs = node.when.split("==")[0].trim();
                node.rhs = node.when.split("==")[1].trim();
                node.operator = "==";
            } else if(node.when.includes("<")) {
                node.lhs = node.when.split("<")[0].trim();
                node.rhs = node.when.split("<")[1].trim();
                node.operator = "<";
            } else if(node.when.includes(">")) {
                node.lhs = node.when.split(">")[0].trim();
                node.rhs = node.when.split(">")[1].trim();
                node.operator = ">";
            } else {
                node.lhs = node.when;
                node.rhs = null;
                node.operator = null;
            }

            node.then = parseLogic(node.then, rtMapTemplates, path);
        }
    }
    
    if(obj.class == "include") {
        let src = obj.source;
        let thisPath = path + src;
        
        while(thisPath.includes("../")) {
            let split = thisPath.split("/");
            let idxOf = split.indexOf("..");
            split.splice(idxOf-1, 2);
            thisPath = split.join("/");
        }
        
        try {
            let logicFile = Resources.readString(Resources.id(thisPath));
            let logicObj = JSON.parse(logicFile);
            
            let newPath = thisPath.split("/").slice(0, -1).join("/"); // Only pass parent dir
            newPath = newPath.endsWith("/") ? newPath : newPath + "/";
            
            obj = parseLogic(logicObj, rtMapTemplates, newPath);
        } catch (e) {
            print("[NTE Script] [WARN] Cannot include file: " + thisPath);
        }
    }
    return obj;
}


function renderLogic(train, displayHolder, vars, logicObj, extraData) {
    if(logicObj.class == "sequence") {
        for(let subLogic of logicObj.nodes) {
            renderLogic(train, displayHolder, vars, subLogic);
        }
    }
    
    if(logicObj.class == "if") {
        let elseNode = null;
        for(let node of logicObj.nodes) {
            if(node.when.length == 0) elseNode = node.then;
            let shouldThen = evaluateIf(train, node, vars);
            if(shouldThen) {
                renderLogic(train, displayHolder, vars, node.then);
                elseNode = null;
                break;
            }
        }
     
        if(elseNode != null) {
            renderLogic(train, displayHolder, vars, elseNode);
        }
    }
    
    if(logicObj.class == "switch") {
        for(let node of logicObj.nodes) {
            let shouldThen = evaluateSwitch(train, node, logicObj.target, vars);
            if(shouldThen) {
                renderLogic(train, displayHolder, vars, node.then);
            }
        }
    }
    
    if(logicObj.class == "cycle") {
        let total = Timing.elapsed() % logicObj.totalDuration;
        let nodeIdx = logicObj.offsets.indexOf(Math.ceil(total));
        if(nodeIdx != null) {
            let node = logicObj.nodes[nodeIdx];
            if(node != null) renderLogic(train, displayHolder, vars, node.then);
        }
    }
    
    if(logicObj.class == "draw") {
        let slots = getSlots(logicObj.slot);
        
        let sx = logicObj.src_area[0] * (actualTexWidth / fullTexWidth);
        let sy = logicObj.src_area[1] * (actualTexHeight / fullTexHeight);
        let sw = logicObj.src_area[2] * (actualTexWidth / fullTexWidth);
        let sh = logicObj.src_area[3] * (actualTexHeight / fullTexHeight);
        
        let dx = logicObj.dst_area[0] * screenWidth;
        let dy = logicObj.dst_area[1] * screenHeight;
        let dw = logicObj.dst_area[2] * screenWidth;
        let dh = logicObj.dst_area[3] * screenHeight;
        
        for(let slotId of slots) {
            let g = displayHolder.graphicsFor(slotId);

            if(debug) {
                g.setColor(Color.black);
                g.setStroke(new BasicStroke(6))
                g.drawRect(dx, dy, dw, dh);
            }
            
            g.drawImage(mapImage, dx, dy, dx + dw, dy + dh, sx, sy, sx + sw, sy + sh, null);
        }
    }
    
    if(logicObj.class == "draw_free_text") {
        let slots = getSlots(logicObj.slot);
        
        let dx = logicObj.dst_area[0] * screenWidth;
        let dy = logicObj.dst_area[1] * screenHeight;
        let dw = logicObj.dst_area[2] * screenWidth;
        let dh = logicObj.dst_area[3] * screenHeight;

        for(let slotId of slots) {
            let g = displayHolder.graphicsFor(slotId);
            g.setColor(Color.black);

            if(debug) {
                g.setColor(Color.black);
                g.setStroke(new BasicStroke(6))
                g.drawRect(dx, dy, dw, dh);
            }
            
            let xSoFar = 0;
            
            for(let part of logicObj.text.parts) {
                const scaled = part.size_v * (0.17 * screenWidth);
                const ogTransform = g.getTransform();
                let transform = new AffineTransform();
                g.setFont(SerifFont.deriveFont(scaled));
                const fm = g.getFontMetrics();
                
                
                let startX = logicObj.text.align_h == 1 ? dx + dw : logicObj.text.align_h == -1 ? dx : ((dx + dw) / 2);
                let startY = logicObj.text.align_v_out == 0 ? dy + (dh / 2) : logicObj.text.align_v_out == 1 ? dy + dh : dy;
                let str = parseVariable(part.text, vars);
                let w = fm.stringWidth(str);
                
                if(logicObj.text.align_h == 1) startX -= w;
                if(logicObj.text.align_h == 0) startX -= (w / 2);

                transform.translate(startX + xSoFar, startY + fm.getAscent() - fm.getDescent());
                transform.scale(1, (screenWidth/screenHeight));
                
                if(xSoFar + w > dw) {
                    if(logicObj.text.overflow_h == "fit") {
                        transform.scale((dw / (xSoFar + w)), (dw / (xSoFar + w)));
                    } else if(logicObj.text.overflow_h == "stretch") {
                        transform.scale((dw / (xSoFar + w)), 1);
                    }
                }
                
                g.transform(transform);
                g.drawString(str, 0, 0);
                g.setTransform(ogTransform);
                xSoFar += w;
            }
        }
    }
    
    if(logicObj.class == "draw_line_map") {
        renderLogic(train, displayHolder, vars, logicObj.template, {
            slot: logicObj.slot,
            target: logicObj.target,
            direction: logicObj.direction,
            dst_area: logicObj.dst_area
        });
    }
    
    if(logicObj.class == "line_map") {
        let wRatio = (actualTexWidth / fullTexWidth);
        let hRatio = (actualTexHeight / fullTexHeight);
        let slots = getSlots(extraData.slot);
        let target = parseVariable(extraData.target, vars);
        let highlightOn = logicObj.animations.highlight.duration_on;
        let highlightOff = logicObj.animations.highlight.duration_off;
        let useHighlight = highlightOn == 0 && highlightOff == 0 ? true : Timing.elapsed() % (highlightOn + highlightOff) > highlightOff;
        
        for(let slotId of slots) {
            let g = displayHolder.graphicsFor(slotId);
            
            let sx = logicObj.src_area[0] * wRatio;
            let sy = logicObj.src_area[1] * hRatio;
            let sw = logicObj.src_area[2] * wRatio;
            let sh = logicObj.src_area[3] * hRatio;
            
            let dx = extraData.dst_area[0] * screenWidth;
            let dy = extraData.dst_area[1] * screenHeight;
            let dw = extraData.dst_area[2] * screenWidth;
            let dh = extraData.dst_area[3] * screenHeight;
            
            if(debug) {
                g.setColor(Color.black);
                g.setStroke(new BasicStroke(6))
                g.drawRect(dx, dy, dw, dh);
            }
            
            let ratio = (dw) / (sw);
            
            g.drawImage(mapImage, dx, dy, dx + dw, dy + dh, sx, sy, sx + sw, sy + sh, null);
            
            let capsuleW = logicObj.capsule_width * wRatio;
            let capsuleX = (logicObj.capsules_x[target] || 0) * wRatio;

            if(useHighlight) {
                let syHighlight = logicObj.variants_y.highlight * hRatio;
                
                let sx1 = capsuleX;
                let sx2 = capsuleX + capsuleW;

                let dx1 = dx + (sx1 - sx) * ratio;
                let dx2 = dx + (sx2 - sx) * ratio;

                g.drawImage(mapImage, dx1, dy, dx2, dy + dh, sx1, syHighlight, sx2, syHighlight+sh, null);
            }
            
            { // Pass
                let syPass = logicObj.variants_y.passed * hRatio;
                let xIncrement = extraData.direction == "left" ? capsuleX + capsuleW : capsuleX;
                
                let sx1 = extraData.direction == "left" ? xIncrement : sx;
                let sx2 = extraData.direction == "right" ? xIncrement : sx + sw;
                
                let dx1 = extraData.direction == "left" ? dx + ((sx1 - sx) * ratio) : dx;
                let dx2 = extraData.direction == "right" ? dx + ((sx2 - sx) * ratio) : dx + dw;
                g.drawImage(mapImage, dx1, dy, dx2, dy + dh, sx1, syPass, sx2, syPass + sh, null);
            }
        }
    }
}

function evaluateSwitch(train, node, target, vars) {
    let targetVar = parseVariable(target, vars);
    let matchVar = parseVariable(node.lhs, vars);
    return evaluateBl(targetVar, "==", matchVar);
}

function evaluateIf(train, node, vars) {
    let lhsVar = parseVariable(node.lhs, vars);
    let operator = node.operator;
    
    if(operator != null) {
        let rhsVar = parseVariable(node.rhs, vars);
        return evaluateBl(lhsVar, operator, rhsVar);
    } else if(lhsVar) {
        return true;
    }
    return false;
}

function evaluateBl(lhs, operator, rhs) {
    // HACK: dist variable not parsed, return 99999999 if non-existent
    if(lhs.startsWith("$dist")) {
        lhs = "99999999";
    }
    if(operator == "==") {
        return tryParseNumber(lhs) == tryParseNumber(rhs);
    }
    if(operator == ">=") {
        return tryParseNumber(lhs) >= tryParseNumber(rhs);
    } 
    if(operator == "<=") {
        return tryParseNumber(lhs) <= tryParseNumber(rhs);
    }
    if(operator == "<") {
        return tryParseNumber(lhs) < tryParseNumber(rhs);
    }
    if(operator == ">") {
        return tryParseNumber(lhs) > tryParseNumber(rhs);
    }
    return false;
}

function getVariableList(train) {
    let frontCar = train.isReversed() ? train.trainCars()-1 : 0;
    let railProgress = train.getRailProgress(0);
    let curPlatIndex = train.getAllPlatformsNextIndex();
    let thisRoutePlatforms = train.getThisRoutePlatforms();
    let allRoutePlatforms = train.getAllPlatforms();
    
    let map = new Map();
    let doorLOpen = train.doorLeftOpen[frontCar];
    let doorROpen = train.doorRightOpen[frontCar];
    
    map.set(`$door[-1]`, (doorLOpen) ? 1 : 0);
    map.set(`$door[0]`, (doorLOpen || doorROpen) ? 1 : 0);
    map.set(`$door[1]`, (doorROpen) ? 1 : 0);
    
    map.set(`$door_run[-1]`, (train.isReversed() ? doorROpen : doorLOpen) ? 1 : 0);
    map.set(`$door_run[0]`, (doorLOpen || doorROpen) ? 1 : 0);
    map.set(`$door_run[1]`, (train.isReversed() ? doorLOpen : doorROpen) ? 1 : 0);
    
    map.set(`$door_closing`, (!train.isDoorOpening() && train.doorValue() > 0 && train.doorValue() < 1) ? 1 : 0);

    if(allRoutePlatforms.size() > 0) {
        let playerRoute = curPlatIndex == allRoutePlatforms.size() ? null : allRoutePlatforms.get(curPlatIndex).route;
        let routes = [];
        for(let i = 0; i < allRoutePlatforms.size(); i++) {
            let platInfo = allRoutePlatforms.get(i);
            let relativeIdx = i - curPlatIndex;
            
            if(platInfo.station != null) {
                map.set(`$sta[${relativeIdx}].cjk`, TextUtil.getCjkParts(platInfo.station.name));
                map.set(`$sta[${relativeIdx}].eng`, TextUtil.getNonCjkParts(platInfo.station.name));
                map.set(`$sta[${relativeIdx}].extra`, TextUtil.getExtraParts(platInfo.station.name));
                
                map.set(`$dist[${relativeIdx}]`, Math.abs(railProgress - platInfo.distance));
            }
            
            let routePushed = false;
            for(let route of routes) {
                if(route.id == platInfo.route.id) {
                    routePushed = true;
                    break;
                }
            }
            if(!routePushed) {
                routes.push(platInfo.route);
            }
        }
        
        for(let i = 0; i < thisRoutePlatforms.size(); i++) {
            let platInfo = thisRoutePlatforms.get(i);
            let relativeIdx = i - train.getThisRoutePlatformsNextIndex();
            
            if(platInfo.station != null) {
                map.set(`$sta_line[${relativeIdx}].cjk`, TextUtil.getCjkParts(platInfo.station.name));
                map.set(`$sta_line[${relativeIdx}].eng`, TextUtil.getNonCjkParts(platInfo.station.name));
                map.set(`$sta_line[${relativeIdx}].extra`, TextUtil.getExtraParts(platInfo.station.name));
            }
        }
        
        if(playerRoute != null) {
            let currentRouteIdx = routes.map(e => e.id).indexOf(playerRoute.id);
            for(let i = 0; i < routes.length; i++) {
                let relativeIdx = i - currentRouteIdx;
                map.set(`$route[${relativeIdx}].cjk`, TextUtil.getCjkParts(routes[i].name));
                map.set(`$route[${relativeIdx}].eng`, TextUtil.getNonCjkParts(routes[i].name));
                map.set(`$route[${relativeIdx}].extra`, TextUtil.getExtraParts(routes[i].name));
            }
        }
    }
    
    return map;
}

function tryParseNumber(str) {
    let val = parseFloat(str);
    if(isNaN(val)) return str;
    return val;
}

function parseVariable(str, vars) {
    for(let [k, v] of vars.entries()) {
        str = str.replace(k, v);
    }
    return str;
}