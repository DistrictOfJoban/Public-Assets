importPackage(java.awt);
importPackage(java.awt.geom);

var useEnglishText = true;

include(Resources.id("mtrsteamloco:scripts/display_helper.js"));

let slotCfg = {
  "version": 1,
  "texSize": [512, 128],
  "slots": [
    {
      "name": "front",    
      "texArea": [0, 64, 400, 64],
      "pos": [
        [[-0.6821, 2.924, 5.611],  [-0.6821, 2.654, 5.629], [0.6928, 2.654, 5.629], [0.6928, 2.924, 5.611]]
      ],
      "offsets": [[0, 0, 0]]
    },
    {
      "name": "back",    
      "texArea": [0, 64, 400, 64],
      "pos": [
        [[0.5756, 2.979, -4.980],  [0.5756, 2.772, -4.980], [-0.5619, 2.772, -4.980], [-0.5619, 2.979, -4.980]]
      ],
      "offsets": [[0, 0, 0]]
    },
    {
      "name": "side",    
      "texArea": [0, 0, 400, 64],
      "pos": [
        [[1.274, 1.791, 4.033], [1.274, 1.586, 4.033], [1.274, 1.586, 2.457], [1.274, 1.791, 2.457]]
      ],
      "offsets": [[0, 0, 0]]
    }
  ]
};

var serifFont = Resources.readFont(Resources.idRelative("mtr:font/cat-arena.ttf"));
const maxTickDispConst = 80;
var dhBase = new DisplayHelper(slotCfg);

function displCreate(ctx, state, train) {
  state.pisRateLimit = new RateLimit(0.04);
  state.dh = dhBase.create();
  state.displTick = 0;

  state.displString = "";
  // state.displString2 = "";
  state.displTickMax = 0;

  state.frontTick = 0;
  state.frontTickMax = 0;
}

function displDispose(ctx, state, train) {
	state.dh.close();
}

function displRender(ctx, state, train, matrices) {
	if (state.pisRateLimit.shouldUpdate()) {
    upadteTick(state, train); // системат тиков, нужна для оптимизации
    let g = null;

    g = state.dh.graphics();
    let fontMetrics;
    fontMetrics = g.getFontMetrics(); 
    
    let ticker = state.displString;
    let end = state.displString2;
    let ticker_width = Math.round(fontMetrics.stringWidth(ticker));
    let end_width = Math.round(fontMetrics.stringWidth(end));
    let route_num = state.routeNum;
    
    state.displTickMax = Math.floor(maxTickDispConst * ticker_width / 700);
    state.frontTickMax = Math.floor(maxTickDispConst * end_width / 500);

    if ((state.displTickMax == 0) || (state.displTick % Math.floor(state.displTickMax / 5) == 0)) { // каждый maxTickDisp-й тик обновляется переменная. Нужно это для оптимизации, дабы каждый тик не вызывать функции
      
      if (train.getThisRoutePlatforms().size() != 0) {
        state.displString = calcDisplString(train);
        state.displString2 = getEndStation(train);
        state.routeNum = getRouteNum(train);
      } else {
        state.displString = useEnglishText ? "Not in service.  " : "Посадки нет.  ";
        state.displString2 = useEnglishText ? "in park." : "в парк.";
        state.routeNum = "--";
      }
    }

    drawTickerFront(g, state.displString2, state, end_width, route_num);
    drawTicker(g, state, ticker, ticker_width);
    state.dh.upload();
  }

  for (let i = 0; i < train.trainCars(); i++) {
    ctx.drawCarModel(state.dh.model, i, matrices);
  }
}

function upadteTick(state, train) {
  state.displTick+=0.25;
  if (state.displTickMax < state.displTick) state.displTick = 0;
  
  state.frontTick+=0.25;
  if (state.frontTickMax < state.frontTick) state.frontTick = 0;
} 

function getEndStation(train) {
  let stationList = train.getThisRoutePlatforms();
  let ret = "";
  ret = TextUtil.getNonCjkParts(stationList[0].destinationName);
  return ret;
}

function calcDisplString(train) {
  let stationList = train.getThisRoutePlatforms();
  let ticker = "";

  for (let i = 0; i < stationList.size(); i++) {
  	if (stationList[i].station == null) continue;
    ticker += processName(stationList[i].station.name);

    if (i != stationList.size() - 1) {
      ticker += " - ";
    } else {
      ticker += ".  ";
    }
  }
  return ticker;
}

function processName(a) {
  if (a.includes('|')) {
    let strs = a.split('|')
    a = useEnglishText ? strs[1] : strs[0];
  }
  a = a.replace('ё', 'е');
  a = a.replace('№', 'no.');
  return a;
}

function drawTicker(g, state, t_string, t_width) {
  g.setColor(Color.BLACK);
  g.fillRect(0, 0, 400, 64);
  g.setFont(serifFont.deriveFont(0, 90));
  g.setColor(new Color(245/255, 204/255, 0));

  let tick = state.displTick;

  let half = Math.round(state.displTickMax / 2);
  let offset = 400 + Math.max(10 + t_width - 400, 0); // 400 - длина строки в пикселях

  let x1 = 0;
  let x2 = 0;
  if (tick < half) {
    x1 = tick / half * (-offset);
    x2 = offset * (1 - tick / half);
  } else {
    x1 = offset * (2 - (tick / half));
    x2 = (tick / half - 1) * (-offset);
  }

  x1 = Math.round(x1);
  x2 = Math.round(x2);
  // print (t_string +"="+t_width)
  g.drawString(t_string, x1, 58);
  g.drawString(t_string, x2, 58);

  // state.dh.upload();
}

function drawTickerFront(g, string, state, t_width, route_num) {
  string += "";
  route_num += "";
  let size = Math.min(70 * 3 / route_num.length, 80);
  size = Math.min(90, size);

  let tick = state.frontTick * 1 % (state.frontTickMax);
  let half = Math.round(state.frontTickMax / 2);
  let offset = 400 + Math.max(50 + t_width - 400, 0); 
  let x1 = 0;
  let x2 = 0;
  let x_route = -9*route_num.length + 34
  if (tick < half) {
    x1 = tick / half * (-offset);
    x2 = offset * (1 - tick / half);
  } else {
    x1 = offset * (2 - (tick / half));
    x2 = (tick / half - 1) * (-offset);
  }
  g.setColor(Color.BLACK);
  g.fillRect(0, 64, 400, 128);
  g.setFont(serifFont.deriveFont(0, 70));
  g.setColor(new Color(245/255, 204/255, 0));

  g.drawString(string, x1, 115);
  g.drawString(string, x2, 115);

  if (route_num.length == 0) return;
  g.setColor(Color.BLACK);
  g.fillRect(0, 64, 115, 128);
  g.setColor(new Color(245/255, 204/255, 0));
  g.setFont(serifFont.deriveFont(0, size));
  g.drawString(route_num, x_route, 120);
  // state.dh.upload();
}

function clamp(num, min, max) {
  return Math.min(Math.max(num, min), max);
} 

function getRouteNum(train) {
  
  let stationList = train.getThisRoutePlatforms();
  let ret = stationList[0].route.lightRailRouteNumber + "";
  return ret;
}