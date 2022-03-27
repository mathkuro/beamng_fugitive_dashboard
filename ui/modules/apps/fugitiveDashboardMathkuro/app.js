angular.module('beamng.apps')
.directive('fugitiveDashboardMathkuro', [function () {
  return {
    template:
    `
    <div class="fugitiveDashboardMathkuro">

      <!--- RAP SHEET表示部分。ボタン押下で表示／非表示切替 -->
      <div class="rapSheet" style="{{ rapSheetBaseStyle }}{{ rapSheetExtraStyle }}">
        <p style="font-weight:bold; font-size:2vw; margin-bottom:0; text-decoration: underline;">{{ rapSheetTitle }}</p>
        <table class="table" align="center">
          <thead>
            <tr align="right">
              <th></th>
              <th>{{ lastResultHeader }}</th>
              <th>{{ bestResultHeader }}</th>
              <th>{{ totalResultHeader }}</th>
            </tr>
          </thead>
          <tbody>
            <tr ng-repeat="row in rapSheet">
              <td align="left" style="width:30%; font-weight:bold;">{{ row.rowName }}</td>
              <td align="right" style="width:22%;">{{ row.last }}</td>
              <td align="right" style="width:23%;">{{ row.best }}</td>
              <td align="right" style="width:25%;">{{ row.total }}</td>
            </tr>
          </tbody>
        </table>
      </div>

      <!--- RAP SHEET表示ボタン -->
      <object style="width:3%; height:3%; box-sizing:border-box; pointer-events:auto; cursor:pointer; float:right;" type="image/svg+xml" data="/ui/modules/apps/fugitiveDashboardMathkuro/rap_sheet_btn.svg"></object>

      <!--- 逃走ゲージ等表示エリア -->
      <object style="width:100%; height:100%; box-sizing:border-box; pointer-events:none;" type="image/svg+xml" data="/ui/modules/apps/fugitiveDashboardMathkuro/fugitive_dash.svg"></object>
    </div>`,
    replace: true,
    restrict: 'EA',
    // Controller定義
    controller: ['$scope', function($scope){
      $scope.rapSheet = [];
    }],

    link: function (scope, element, attrs) {
      'use strict';
      var streamsList = ['electrics'];
      StreamsManager.add(streamsList);

      const SETTINGS_PATH = '/ui/modules/apps/fugitiveDashboardMathkuro/settings.json';

      const DEFAULT_LANG = 'en';
      const SUPPORT_LANGS = ['en', 'ja'];

      // 追跡情報：バウンティ・車両衝突回数・違反回数・追跡時間・ロードブロック設置回数
      const RESULT_COLS = ['pursuitTime', 'bounty', 'hitCount', 'offensesCount', 'roadblocks'];

      // BeamNG.driveの実装上のヒートレベルは最高3まで。(v0.23時点)
      const MAX_HEAT_LEVEL = 3;

      // リアルタイムの追跡情報用の変数を初期化。リアルタイムの値を格納するものなので初期値は全て0。
      var currentResult = {};
      for (const col of RESULT_COLS) {
        currentResult[col] = 0;
      }
      var lastHeatlevel = 0;
      var lastRoadblockState = 0;
      var roadblocks = 0;

      // 追跡情報を処理するためのクラス。クラス化するほどのものではなかったかも。
      class Result {
        constructor(arg = resultBase) {
          var data = {};
          for (const col of RESULT_COLS) {
            data[col] = (Number(arg[col])) ? arg[col] : 0;
          }
          this.data = data;
        }

        // クラス分けるほどのことでもないので最高・合計記録用のメソッドを両方入れておく。種類が増えてきたら分割考える。
        update(data) {
          for (const col of RESULT_COLS) {
            this.data[col] = (data[col] && data[col] > this.data[col]) ? data[col] : this.data[col];
          }
        }

        add(data) {
          for (const col of RESULT_COLS) {
            if (data[col]) {this.data[col] += data[col];}
          }
        }
      }

      // 秒単位のsec(int型)をHH:MM:SS.fff形式に変換する。digitsは小数点以下の桁数。
      function sec2TimeStr(sec, digits = 0) {
        if (!Number.isFinite(sec)) {return '00:00:00';}
        var secStr = ('00' + (sec % 60).toFixed(digits)).slice(-(3 + digits));
        var minStr = ('00' + (Math.floor(sec / 60) % 60)).slice(-2) + ':';
        // hourは1時間超えた時以外は非表示（割と幅とって邪魔だから）
        var hourStr = (Math.floor(sec / 3600) > 0) ? ('00' + Math.floor(sec / 3600)).slice(-2) + ':' : '';
        return hourStr + minStr + secStr;
      }

      // 画面表示用に適宜整形を行う。(追跡情報は内部では数値型で持つ思想)
      function prettify(data) {
        data.pursuitTime = sec2TimeStr(data.pursuitTime, 2);
        data.hitCount = data.hitCount.toLocaleString(undefined, {maximumFractionDigits: 0});
        data.offensesCount = data.offensesCount.toLocaleString(undefined, {maximumFractionDigits: 0});
        data.bounty = data.bounty.toLocaleString(undefined, {maximumFractionDigits: 0});
        data.roadblocks = data.roadblocks.toLocaleString(undefined, {maximumFractionDigits: 0});
        return data;
      }

      // リアルタイム描画部分の処理
      function draw(svg, pursuitData, langName = DEFAULT_LANG) {
        if (!('mode' in pursuitData) || !('timers' in pursuitData)) {return;}

        var heatLevel = pursuitData['mode'];
        var timers = pursuitData['timers'];

        if (heatLevel > 0) {
          // 時刻はなぜかマイナスになることがあるため0未満の時は0に補正
          currentResult.pursuitTime = (timers['main'] > 0) ? timers['main'] : 0;
          currentResult.bounty = pursuitData['score'];
          currentResult.hitCount = pursuitData['hitCount'];
          currentResult.offensesCount = pursuitData['offensesCount'];

          // ロードブロックが設置されたら1カウント
          if (pursuitData['roadblockState'] > 0 && lastRoadblockState == 0) {roadblocks += 1;}
          lastRoadblockState = pursuitData['roadblockState'];
          currentResult.roadblocks = roadblocks;
        }

        var arrestLimit = (timers['arrest'] > 0 && timers['arrestLimit'] > 0) ? (timers['arrest'] / timers['arrestLimit'] * 100) : 0;
        var evadeLimit = (timers['evade'] > 0 && timers['evadeLimit'] > 0) ? (timers['evade'] / timers['evadeLimit'] * 100) : 0;
        if (evadeLimit > arrestLimit) {
          arrestLimit = 0;
        } else {
          evadeLimit = 0;
        }

        // 逮捕判定の間は時刻等の数値が想定外の値を示すため描画を更新しない(各値の初期化タイミングが異なる為？)
        if (heatLevel > -1) {
          svg.getElementById('arrest-limit').setAttribute("width", arrestLimit);
          svg.getElementById('evade-limit').setAttribute("width", evadeLimit);

          // 手配度の星の塗りつぶし
          for (let i = 1; i <= MAX_HEAT_LEVEL; i++) {
            var opacity = (heatLevel < i) ? 0 : 1;

            svg.getElementById('heatLevel' + i).setAttribute("style", "fill:#ffffff;fill-opacity:" + opacity + ";stroke:#ffffff;stroke-width:3.78069;stroke-miterlimit:4;stroke-dasharray:none;stroke-opacity:1");
          }

          // リアルタイムに更新する値の部分はtoFixedで桁数を固定しておかないと見栄えがイマイチ。表示幅的にカンマもない方が良い。
          svg.getElementById('pursuitTime').textContent = sec2TimeStr(currentResult.pursuitTime, 2);
          svg.getElementById('hitCount').textContent = currentResult.hitCount.toLocaleString();
          svg.getElementById('bounty').textContent = currentResult.bounty.toFixed(1);

          // 違反内容は記録に残さないのでデータを直でOK
          var tempOffenses = String(pursuitData['offenses']);
          var offensesText = '';

          if (typeof tempOffenses == 'string') {
            var lang = getLang(langName);
            for (const offense of tempOffenses.split(',')) {
              offensesText = (lang.offenses[offense]) ? offensesText + ' ' + lang.offenses[offense] + ' ' : offensesText;
            }
          } else {
            offensesText = '';
          }
          svg.getElementById('offensesText').textContent = offensesText;
        }

        /*
         * 追跡終了(逮捕or逃走成功)でプロファイルを更新
         * リザルト画面出した状態で追跡終了した場合に画面上の結果が更新されないが、レアケース＆リロードで解決可能、なので気にしない
         */
        if (lastHeatlevel > 0 && heatLevel <= 0) {
          bngApi.engineLua('jsonReadFile(' + bngApi.serializeToLua(SETTINGS_PATH) + ')', (settings) => {

            var langName = (SUPPORT_LANGS.includes(settings.lang)) ? settings.lang : DEFAULT_LANG;
            var bestResult = new Result(settings.best);
            var totalResult = new Result(settings.total);

            bestResult.update(currentResult);
            totalResult.add(currentResult);

            // 次回以降も参照されるように最高・累計記録をファイルに保存
            var result = {lang:langName, last:currentResult, best:bestResult.data, total:totalResult.data};
            // v0.23の更新でファイル書き込みを行うとUIが更新される機能が追加されたので逮捕判定期間ずらして書き込みを行い、UIの醜さを最小限に抑える苦肉の策
            setTimeout(
              function() {bngApi.engineLua('jsonWriteFile(' + bngApi.serializeToLua(SETTINGS_PATH) + ', ' + bngApi.serializeToLua(result) + ', ' + bngApi.serializeToLua(true) + ')');},
              4700);
          })

          roadblocks = 0;
        }
        lastHeatlevel = heatLevel;
      };

      var obj_main = angular.element(element[0].children[2]);
      obj_main.on('load', function () {
        var svg = obj_main[0].contentDocument;

        bngApi.engineLua('jsonReadFile(' + bngApi.serializeToLua(SETTINGS_PATH) + ')', (settings) => {
          var langName = (SUPPORT_LANGS.includes(settings.lang)) ? settings.lang : DEFAULT_LANG;

          scope.$on('streamsUpdate', function (event, data) {
            bngApi.engineLua('extensions.gameplay_traffic.getPursuitData()', (pursuitData) => {
              if (pursuitData) {draw(svg, pursuitData, langName);}
            });
          });
        });
      });

      var obj_rap_sheet = angular.element(element[0].children[1]);
      obj_rap_sheet.on('load', function () {
        var profileEnabled = false;
        var svg_rap_sheet_btn = obj_rap_sheet[0].contentDocument;
        var rapSheetBtn = angular.element(svg_rap_sheet_btn.getElementById('rap_sheet_btn'));

        rapSheetBtn.on('mousedown', function () {
          bngApi.engineLua('jsonReadFile(' + bngApi.serializeToLua(SETTINGS_PATH) + ')', (settings) => {
            scope.$evalAsync(function() {
              var langName = (SUPPORT_LANGS.includes(settings.lang)) ? settings.lang : DEFAULT_LANG;
              var lang = getLang(langName);

              var last = prettify(new Result(settings.last).data);
              var best = prettify(new Result(settings.best).data);
              var total = prettify(new Result(settings.total).data);

              if (profileEnabled) {
                profileEnabled = false;

                scope.rapSheetTitle = '';
                scope.rapSheetBaseStyle = '';
                scope.rapSheetExtraStyle = '';
                scope.lastResultHeader = '';
                scope.bestResultHeader = '';
                scope.totalResultHeader = '';
                scope.rapSheet.length = 0;
              } else {
                profileEnabled = true;

                scope.rapSheetTitle = lang.title;
                scope.rapSheetBaseStyle = lang.baseStyle;
                scope.rapSheetExtraStyle = lang.extraStyle;
                scope.lastResultHeader = lang.lastResult;
                scope.bestResultHeader = lang.bestResult;
                scope.totalResultHeader = lang.totalResult;
                for (const elem of RESULT_COLS) {
                  scope.rapSheet.push({rowName: lang[elem], last: last[elem], best: best[elem], total: total[elem]});
                }
              }
            });
          });
        });
      });

      scope.$on('$destroy', function () {
        StreamsManager.remove(streamsList);
      });

      // ---- UI上に表示する言語の設定 ----
      function getLang(langName){
        if (langName == 'ja') {
          return new JaLang();
        } else {
          return new EnLang();
        }
      };

      class BaseLang {
        title = 'RAP SHEET';
        baseStyle = 'text-align:center; color:lime; background-color: rgba(0,0,0,0.7); font-size:1vw;';
        extraStyle = '';
        lastResult = 'LAST';
        bestResult = 'BEST';
        totalResult = 'TOTAL';
        pursuitTime = 'TIME';
        bounty = 'BOUNTY';
        hitCount = 'HIT COUNT';
        offensesCount = 'OFFENSES COUNT';
        roadblocks = 'ROADBLOCKS';

        offenses = {speeding: 'Speeding', racing: 'Racing',
                    hitPolice: 'Hit(Police)', hitTraffic: 'Hit(Traffic)',
                    reckless: 'Reckless', intersection: 'Intersection',
                    wrongWay: 'Wrong Way'}
      };
      
      class EnLang extends BaseLang {};
      
      class JaLang extends BaseLang {
        title = '逃走記録';
        extraStyle = 'font-family: "YuGothic", "Yu Gothic", "Hiragino Kaku Gothic Pro", "Meiryo", sans-serif; font-size:1.1vw;';
        lastResult = '前回';
        bestResult = '最高';
        totalResult = '累積';
        pursuitTime = '追跡時間';
        bounty = 'バウンティ';
        hitCount = '車両被害台数';
        offensesCount = '違反回数';
        roadblocks = 'ロードブロック';

        offenses = {speeding: '速度超過', racing: '速度超過[重度]',
                    hitPolice: '公務執行妨害', hitTraffic: '当て逃げ',
                    reckless: '危険運転', intersection: '信号無視',
                    wrongWay: '逆走'}
      };
    }
  };
}])
