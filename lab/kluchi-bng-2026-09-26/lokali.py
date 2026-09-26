#!/usr/bin/env python3
"""Имя на языках под Brown Noise Generator — замер местного спроса по странам (канон 3.4), 2026-09-26.
Канон 3.4: имя на языке = местный поисковый ключ (не буквальный перевод), можно склеить с английским
через тире. Вручную — список 1 (DE FR ES IT NL SV DA NO FI) + первые три списка 2 (AR ID RU);
PT-BR и JA добавлены, как в замере 07-26. Автор дал «да» на ≈ $1,2 (26.09).
Один пакет Google Ads на страну (цена за запрос, не за ключ) ≈ $0,09, ряд за 4 года.
  python3 lokali.py        → lokali.csv + raw/lokal_<код>.json + spend.log
"""
import csv, datetime, json, os, sys
sys.path.insert(0, os.path.expanduser('~/PycharmProjects/teacher-lab/issledovaniya/konkurent-po-funkcii-2026-09-13'))
from dfs import call  # noqa: E402

HERE = os.path.dirname(os.path.abspath(__file__))
RAW = os.path.join(HERE, 'raw')
EN = ['brown noise', 'brown noise generator', 'white noise', 'white noise generator', 'pink noise', 'noise generator',
      'brown noise for studying']
STRANY = {
    'de': (2276, 'de', ['braunes rauschen', 'braunes rauschen generator', 'rauschgenerator', 'weißes rauschen',
                        'weisses rauschen', 'rosa rauschen', 'braunes rauschen zum lernen', 'braunes rauschen konzentration',
                        'white noise generator deutsch']),
    'fr': (2250, 'fr', ['bruit brun', 'bruit marron', 'générateur de bruit brun', 'générateur de bruit', 'bruit blanc',
                        'générateur de bruit blanc', 'bruit rose', 'bruit brun pour étudier', 'bruit brun concentration']),
    'es': (2724, 'es', ['ruido marrón', 'ruido marron', 'ruido café', 'generador de ruido marrón', 'generador de ruido',
                        'ruido blanco', 'generador de ruido blanco', 'ruido rosa', 'ruido marrón para estudiar']),
    'it': (2380, 'it', ['rumore marrone', 'rumore bruno', 'generatore di rumore marrone', 'generatore di rumore',
                        'rumore bianco', 'generatore di rumore bianco', 'rumore rosa', 'rumore marrone per studiare']),
    'nl': (2528, 'nl', ['bruine ruis', 'bruin geluid', 'bruine ruis generator', 'ruis generator', 'witte ruis',
                        'roze ruis', 'bruine ruis studeren']),
    'sv': (2752, 'sv', ['brunt brus', 'brunt brus generator', 'vitt brus', 'rosa brus', 'brusgenerator', 'brunt brus plugga']),
    'da': (2208, 'da', ['brun støj', 'brun stoj', 'hvid støj', 'lyserød støj', 'brun støj generator', 'støjgenerator']),
    'no': (2578, 'no', ['brun støy', 'brun stoy', 'hvit støy', 'rosa støy', 'brun støy generator', 'støygenerator']),
    'fi': (2246, 'fi', ['ruskea kohina', 'valkoinen kohina', 'vaaleanpunainen kohina', 'ruskea kohina generaattori',
                        'kohinageneraattori']),
    'ar': (2682, 'ar', ['الضوضاء البنية', 'ضوضاء بنية', 'الضجيج البني', 'ضجيج بني', 'مولد الضوضاء البنية',
                        'الضوضاء البيضاء', 'ضوضاء بيضاء', 'الضوضاء الوردية', 'مولد الضوضاء البيضاء']),
    'id': (2360, 'id', ['suara brown noise', 'brown noise untuk belajar', 'white noise untuk belajar', 'suara white noise',
                        'noise coklat', 'suara coklat', 'white noise untuk tidur']),
    'ru': (2643, 'ru', ['коричневый шум', 'коричневый шум для учебы', 'коричневый шум для концентрации',
                        'генератор коричневого шума', 'генератор шума', 'белый шум', 'генератор белого шума', 'розовый шум']),
    'pt': (2076, 'pt', ['ruído marrom', 'ruido marrom', 'barulho marrom', 'gerador de ruído marrom', 'gerador de ruído',
                        'ruído branco', 'ruido branco', 'gerador de ruído branco', 'ruído rosa', 'ruído marrom para estudar']),
    'ja': (2392, 'ja', ['ブラウンノイズ', 'ブラウンノイズ 勉強', 'ブラウンノイズ 集中', 'ホワイトノイズ', 'ピンクノイズ',
                        'ノイズ 生成', 'ホワイトノイズ 生成']),
}


def god(y, m):
    return y if m >= 9 else y - 1


def main():
    rows, itogo = [], 0.0
    for kod, (loc, lang, mestnye) in STRANY.items():
        keys = list(dict.fromkeys(EN + mestnye))
        try:
            res, cost = call('keywords_data/google_ads/search_volume/live',
                             [dict(keywords=keys, location_code=loc, language_code=lang, date_from='2022-09-01')])
        except SystemExit as e:
            print(f"{kod}: ошибка API — {e}")
            with open(os.path.join(HERE, 'spend.log'), 'a') as f:
                f.write(f"{datetime.datetime.now(datetime.timezone.utc):%Y-%m-%dT%H:%M:%SZ}\tlokal-{kod}\t$0.0000\tошибка: {e}\n")
            continue
        itogo += cost
        json.dump(res, open(os.path.join(RAW, f'lokal_{kod}.json'), 'w'), ensure_ascii=False)
        with open(os.path.join(HERE, 'spend.log'), 'a') as f:
            f.write(f"{datetime.datetime.now(datetime.timezone.utc):%Y-%m-%dT%H:%M:%SZ}\tlokal-{kod}\t${cost:.4f}\t{len(keys)} ключей, 4 года\n")
        for it in res:
            by = {}
            for m in it.get('monthly_searches') or []:
                by.setdefault(god(m['year'], m['month']), []).append(m.get('search_volume') or 0)
            sred = {g: round(sum(v) / len(v)) for g, v in sorted(by.items()) if len(v) >= 6}
            gg = sorted(sred)
            rows.append(dict(yazyk=kod, kluch=it['keyword'], mestnyj='' if it['keyword'] in EN else 'да',
                             obem=it.get('search_volume') or 0, konkurenciya=it.get('competition') or '',
                             za_god=f"{(sred[gg[-1]] / sred[gg[-2]] - 1) * 100:+.0f}%" if len(gg) >= 2 and sred[gg[-2]] else '',
                             za_3_goda=f"{(sred[gg[-1]] / sred[gg[-4]] - 1) * 100:+.0f}%" if len(gg) >= 4 and sred[gg[-4]] else ''))
        print(f"{kod}: {len(res)} ответов · ${cost:.4f}")
    with open(os.path.join(HERE, 'lokali.csv'), 'w', newline='') as f:
        w = csv.DictWriter(f, fieldnames=list(rows[0]))
        w.writeheader()
        w.writerows(rows)
    print(f"итого ${itogo:.4f} → lokali.csv")


if __name__ == '__main__':
    main()
