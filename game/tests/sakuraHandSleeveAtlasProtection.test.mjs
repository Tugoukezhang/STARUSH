import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import {createRequire} from 'node:module';
import {brotliDecompressSync} from 'node:zlib';
const root=fileURLToPath(new URL('..',import.meta.url));
const sharp=createRequire('C:/Users/1/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/package.json')('sharp');
const sha=b=>createHash('sha256').update(b).digest('hex');
// Reviewed sparse masks are embedded; the test never reads a temporary source or QA directory.
const candidates=[
  {
    "group": "refined",
    "file": "public/art/sakura-refined-20261006/parts.webp",
    "data": "public/art/sakura-refined-20261006/views.json",
    "sourceSha256": "9d460e2942dd774bb255af3ede3d937512349c244cf6507212560086599a8b83",
    "sha256": "ee740b939830c683f07459fb0b785bead0b4fe475730021314c19e561a568397",
    "bytes": 776908,
    "geometrySha256": "94d177bbe8e3e38732b55a6949468451bbded7f40540b0a76c71b88d0bd0f8a1",
    "alphaSha256": "1f2d2e2b5f7868da19ce5424f476d43b5d694d8565e6f76548c63f6d585b2c20",
    "protectedRgbaSha256": "c92f9a1823c75e68a4b2540f510169f0d01e444184e6a2930ea68e3b059de329",
    "maskSha256": "8d5fb93f3be53f6be28986fe701f2d89b5402ac95583ce48dc9ca6a814326410",
    "mask": "m///H0akYsWOSK5IAbIRuqW3xQIIgCfar1WL5IsJs9D6iSEl5s/MQ3bkdH+Dhjfzv5aW1DOSTg45EeCdnqu5lBL0ysi1AJoZGvDdbslJezEgyyGhkDi3kZkh0fR/qprQqtKc5oI8uqBwOZszL3LI0H8tm71ZcjCCwogQgvIXiQ6EQqkLQwoyKYyS/Ho0edTWqisUQiOEAEqsqWdlh1SgX4gu0FYnO6eRkuVG2VPxpZ0f+ud/qc6c+x5Y4CTq9qfKSwlabehcGTvBN8P9nyL8HtNfAu59dO/brCeA0f8GPuSp3ko9XmT9DgBg8iVusDLOf+g/WllfAQAckedWDr85byanVooCFQZ/WYeeGmz4mxOQc5VyegUL0GK7DnMv9/FNXmBD2pyAoGuUV1WoAC226zD3ch/f5AU2pM0JCLpKeWUFCtBiuw5jL/j5LV5gzVocq/edWLxGhQnQYrsSYy/3+S1eYHdi8asriqHunBJafplKTL3cBpi8v5q1OFXvO7l4rYoRwMV2HcZecAMsXmDN2huq551kvF6FCNBiuw5TL7gBFu+vZi0OVb1LxmtWhAAtvisx9aI6IH9/5Zc3AEL+23E5211Ynyz/bWwndkLLh6YL1+o+9jaLJHZCS62Fx/CYmzKmbm/shJbSYaIliTy0zDNymo3iw+zaBdtKnOuQgXd1rYackZaz3YAC2/axFMxgiQ+zh1GRXBMwhKWuM9EIG/9snDNnosV3+Vhpukkayh77ED6IgVsn904MirByrvdrakhBie+A01HRi4mU7HViCROCcqavw8cHMXDr5B6KARFQznM/NlBSVOI7cQNO5qzR85xZAkTHxAMZZZDQpFJupMT99hLMj4HY9wI0mKWmIPkAvZ1xH0yMeMkrpUZIPkBvZ1IBWi5DzB0BMOJBTAY4iG8wgg3EiMhH6C2Nh+CkFJsSE+XJTDigiQDtl0HmZgCA6M34IFbpZTbMXwLw+oLB4/yul5dV2C5TxQX4L+Xr8GUlJMqybk4IB7Jxdjt0giMpKRgEjTh0vJCVcwo+pIXJMXFonBCDYF6qcfCSfxL/AwEPt6As01pAmDZe8C/CfyAgj3bPt7kdraYJhPCgS+uvmLbdnzEMEg7O7vX7rCNRQto4B5qOgy7Nfq4jYdcqIFzLS70y3Ieq0mt1xsowdrbO3+sAdx9RGb4dYJdKESpDhYPvVutrQs4nvBaWfbcTMnhJJ4/DcHxO8DsQCdNVj/7jvvsETzY/+EdeCA/frEYQPlqvnLWvBoU7X0IZBjx8r/qqwXMG+mQKx6/E0Vslz2KFIOJ71YWDj9esZiwWbi3wjj1t2xQppGnDkr6i26Ik0tPb5IR51QmDgQx5fBr9X5y9KnQUJbQ5waUEssQCzFWhdPThUDyG95e5Y+GFIOb+ox+jggjzrkMDGl+pthI4f2/2ByQcfERWOPkVc22XIoQdDw9Q24EI6Hd03A0Jh3Lh7L3w75fLlc1ShBC14f1IRYwZalPE3wPskAKgDLEbelA1VHwsp9BnJSDc3x7bMiIQnvMC2e1TFYBj946+mPva8qn4q4wFy0KH8E5g4+nFksc0B6XRFS7Szlve7ke9yL8fCrwsbr3/ZZL//99iBGrELBRstE5xSb11oN6qYh1/Zn6oiMUtol7eeosq9pk42GSdmXk9ov1p4YtkdMoMVyYAKPJiG62dt3XW+9P7SCRssc6MfujSNT37BWydMG5B36vI4GEEl72Ho+0nZmJhg7UKGbnNm1VOMBIoHR/LEqw5Rrzsbvjylsagh1jYXq1QWG/XNglb5E6lofG4HGZ58j5VmG9qJBmXKWcpsCDhppet3sXBJYlOrcEYhwPzuXdHNzCEeVvjyVTxplMJN1e3iFSvhE9zOsFsJIZaZC1rj6EK842NKclKPw8MJGzUuccuafgkS8MwWYr+K5tHJowWhjB2qerLtzauTNMJw0sqCUR3k2r6dgexRqxs1iWEvLPjIAMZxnSRVsUOopVYLRhM1M/IbgLFIn/TK3tsZNPWynDlUWHmSVxLX7O60VQJAgvxa7RsKIZe1v/pq83LqnZv6j7GLAXDhK7CTQOF2y3pSgJYIuD5gG48s7kEq/p9JawuJ7d06GPMJZyZW/Wjninc9HjYj5Qy4xljYOzV1248mq1t3aNz1liWPHWVTwjKmeQtDIgH0PsDlEjplMQd1SIDdlSR9/JHBqL5E77ON+FjgbVv3WJvd1loNfmFhhtxUUDxdxZI7Kce6S4A/CctaDyMzGx+he1LJJJugpUaTg0Qv1zD0WrZOg844uFWXFSZbiMkbjmS3vSf3+jEHyFS/wEP+KNXS6/9RwDGA1prmbxTxSxWfPUDX8c1TXyVChpmY4i9k1H7Pr9Hms6/voiep5yr1/JW85Q+U6bLibiLQwRsVzOD91IP8RK8d7GI7VoUWxTxQ8N3vtGLuTSs+jZQqqgX73nlkCSXH7FwQ25ypEpCeqno9Yo0pJ5+URNkyWFuPJLuLOtKlUGXMEBvamr+D90SBsd1xSiMe6mH8CT+uwx/rb5d5O5vELdadM+Xa5kSeVAz1iS7caTirJEQEcYDQyhCF/CF31R6mzxQaDPej0vWgKS9cW4d5MhPH2v4w9DK+WfE7Gskck7XFZhh4bH1lSW2q4E/0MhMT/pxjB/Ykrr38hBwr6e6tGy8+v1mLkdl8s7GImO76sAz3BabOOGgtx+du7/B/ZzIKm8fQOZTCManKZYOJI26lcy9jUi6eQ0nrOjSI/6r2BWZqG5Ljcz0UcuNS75zIhaNK/hYznEPpQRi0TZjcHejkqtNE8TgogKmejMaZcJ3njnWlXuz3I8mumbuTK3MGDdo/owb5ykAtKZdUHH10Qwl8gZT9Jz4G4yGGaTcxpiDU1LqK2HMBSaEeX+jk6bVEjx99I6nBIYoLj4jMJY10HtipF9DQZfhAQxEzAGneZEP5SL98AaFcT81EtRIo1uYwT0QZxhS1nlhYDLYKhtidIPMeU4I8x5HKUM3jgEVNwLM0BzxTwMF5+jKrV/Rb4RxILLasILH4yxv8kk6Gj1on6MZYOwo5lE8lNsdqkUzqeONaBMZeSPBiNFzIiSeyo30PbsEvad68T9OBdIUAI7MQLsv+aM0M5S0Wfix9bUSuSpyRzxM/LbqVQONK9P2FXYjcpRfnNhR8UOAyEBMLOYEJ6IdCUYzqI2vx8Gq+MnRbsUfpZGqelAO4CccWOLJkiT7W4UnXxIOwiw6BhXB/QxAMq0iyNgg4FvnWJ+jngfUAMyiJX6w5bBKCumqCnwYawzwAxsJviwMgdPdQVydjWF0l3b0ejwDELhEaNDTqUDx7smVJl8OOV8bNv4hgIRzIsG+AgAUGSX2EsA3Bp6ROXSi4ge7BRGfv8E/Cw3XTivhcPWUtz2tivgSuj+pQy2ZyNnb2EE9Cw2bgnDX2LfvoC/WLDn/Q6C0V1HLT1B8ps28/HaGCxcNl00J/v7/w6HKEcrprZQdsbRTUctSRPxWKz8edOG2l00MgFgAYMvO6n7yzsVk8e3hnb85wAz2QaDEHxuIGnF6iqAECv1tfKIiVyCxVkp8mjGg4Zg4pYVmhhEdCSQqlkmF5UtaTd1GK0DR6SMoFklJOJX0uETAckctdBQn3R8FD0ukUIjbg5eHaqGiOOnkERULpOSamEp68iooupIWIYVNJ4eoWB5VCDXZDg1Nl9HSKkDpfia4WByl4qtj4wYFp8toZS6y9lpf2oiLpVEy6tAEgQany2ilLrB2W1/SzLhYGOUU2WOygwKMxWLiC5PuXwKMZVFCxpmbo4CL5WJCiqrd1pU2MzIWRTlF9ZieVwJjwbhw5gdjYWnlS0HtEzS5ApPuUwqNBVFfWQdm+wmiwk8KoWbsPGhA+wRNLcGxSaDTMEwf+vdKiCj7/EyxoKSTVOPlI/i6sFiVfZ8qpKWwAtj9Zpq+gHiz5phBIZeoKBPJmeE1+Z8eccum+0kGIF53W/Y6EWLrZ6n3Q1lYBVCGzsAdGWxU6Z8eW0nPbs1Rz1ZzSwvD17/H8Cmh8X2lI6kizX0wIwkzOgUs22BBUmhBp6gtBxhaDjqw+7oMH2lYPBLuibKMEfWA8nOFXgJHFzKgSMPeQv90hos0vRecn+opLP6Ad8CN8Jmx1qjXS+Mk4GMPcZDXnETY4OCxllenyQJyOD30Lxa9xQ16KtwDxQlc/G/sS1JvgpV2Zbs5y0cp1HBC3ECUZE5KoNlryrJm7cJgpCl6vBd8W2J3fhFbnRRxsLgIQO8vcXhoar0C7otXZC8zDHgstIGI6mWrVVj0VIgZk1wGk7wA7oOHwBlIlmIu/ow4islWAKyUnoCBTQT8YtS5JQD24NFiJKC1nuJehMDAtoxQZoaWxbryPz1Zid1SicSQ1nIxGr0c+8sseQwFuBKYJH3AUVBnHIH22djaQHmdHr5ttY01GN3I3lFdX1eTyhjYVR3AV8I74mXRuAuHBcDwzvOIuyQ5TwkOwLzpXwdBxT0AZV8/lxibN/HTI4tUGogOwOtcB/AREAS8hnAVNOFEDwIkpo+Dd8TbUmNMfWB2NnRpaasNXRo6fB+wkoy2zKRBYg2Ad8CrcGpCU/P46yB6pEpu/S45mZokJYr2x9CAScdPw2Y8j27ZGvI/PXxPTT3qQVcJRT2kDXLjkmmqIgbUwRUA7YyL8aPwDrgQLCUNLJ7AUutY94x4FwAEq3+lW0CopJRRECSkqgZSaZ2elIYcH0NekHwsb4wtxObD/vFNUgUa1zN/vePBk5B/6+p5m+QOJrHlJf+xkXuWcDTpEFEjEpD/IXyF3x9jLiDO8kqDYkYft1R9IKEsdOIdivtJ/zxzOiDbLy/Ez4xihp9ZDA//8bszH8c7d+npn6w4vhZsPgAsiDnr4jgBoAvDb4+ilNnHkDAcUCGMVQdS0Y+mdoKzMvHnfotnQUNtgPeRf6sS3bMg46xA4YlVMaw2YLydigCgJp0lFWqoaQET2JsRET4kIOyUKPhaNwQAKkgYisQans6iHglDTnXjGzRTfhSM2O0rwwCWcGmvug8AxuzD/r164AaI2/+7kEII2zDURAphm0eaiCFuAzkTOQRuImUiiMiNhEwUEbqZiIkmYjeUMBFF8KbyJbKI3li8BOlPASB6C7kvIfcl5L68aBhR+NAKmUCWC16/L+ACysjxXHTpxG5FBuxsQuwukARPDpdi9vsCFEiGR4dKFOJMSc6FMkrnc6TS+kI5SseDpBSfK8wZjAy/Jj5S53OkqgFLOcDASXxwD0TBmsQEd0AIxIkGSN6EgPuTAGlxu4fcS/r9hgV7ge5F/O/ktSB3hfcXCm8h9yS5D7qT4D4h90x4DB8n4cqgmL4gjicXau9IDBgNIeR7BNZ0DP/ngRy3CSLpE3EkOuibiDiUJHEeFOgYgfF/HsBJLcSa9zNgjMkhhryPhJYef9OfaBCZl52IPp94g5TIXZNFG+kfgQ9F7roRVRiZHwQjX2NyehMhGqOf6u5MBFjM4w36gjyiNP+q97QEwlq6DImhQ+jiSVXH0Y9I0ZiXzsTdj2iQ2OtlVCXkey52ZEIh+H3/buq4xOOxA1SZUQsi41OypF+GiDx2kI6JJPF+BZCKr16z/UTj0YNVRv5NFWmflx/dx34sz78LeBPfhuUhA+BNoQXH/QZgm/hP/lLeCBmAK/U0XB47SGnNxYIC6IYCLK9Nx/L4wbticXkAAV4tYB5BiB50SOYhBHmVoHkMYV4+dB5EoOUZAs+jCLU89QHd/UD0OIL1WEB6IOFWNEyPJOACfQioCyXkgreO6p7hjmak7hWyuCioBxPy4Rm1E9JfWPwigI9f8V9pHDx0gk328/F9E1PqwULjulejZPfrAPj8FMCHpISQFZIvdT4UpY4Dxe0MzOAMaLiexQb6uaw0JMap5xgEB5Nab/DUNQggJhJ1uvDhhIN9gHvGD7U+nuLhUwBLWdcYUJhlGoUFIDG59hixx0h44VijnACZJ2Cb2GRErIY5WSMkJlIv94NRYmHdoqZEjBITf0Q3ZZGoeLFHjkHCYv6nCDxs/OEaBR3TNYN45d1YAA==",
    "changedPixels": 39723,
    "parts": [
      {
        "direction": "front",
        "name": "arm.L",
        "region": [
          255,
          310,
          104,
          181
        ],
        "registrationFit": {
          "cost": 0.06231454005934718,
          "scale": 1,
          "dx": 0,
          "dy": -2
        },
        "changedPixels": 4807
      },
      {
        "direction": "front",
        "name": "arm.R",
        "region": [
          947,
          310,
          110,
          169
        ],
        "registrationFit": {
          "cost": 0.07357357357357357,
          "scale": 1,
          "dx": 0,
          "dy": 0
        },
        "changedPixels": 4643
      },
      {
        "direction": "front",
        "name": "grip-fingers",
        "region": [
          1089,
          310,
          110,
          169
        ],
        "derivedFrom": "arm.R RGB at identical local UV; original overlay alpha",
        "changedPixels": 344
      },
      {
        "direction": "left",
        "name": "arm.R",
        "region": [
          1231,
          310,
          86,
          168
        ],
        "registrationFit": {
          "cost": 0.04713804713804714,
          "scale": 1,
          "dx": 0,
          "dy": 0
        },
        "changedPixels": 4489
      },
      {
        "direction": "left",
        "name": "grip-fingers",
        "region": [
          1349,
          310,
          86,
          168
        ],
        "derivedFrom": "arm.R RGB at identical local UV; original overlay alpha",
        "changedPixels": 434
      },
      {
        "direction": "left",
        "name": "arm.L",
        "region": [
          636,
          310,
          77,
          179
        ],
        "registrationFit": {
          "cost": 0.0548885077186964,
          "scale": 1,
          "dx": 0,
          "dy": 0
        },
        "changedPixels": 4407
      },
      {
        "direction": "right",
        "name": "arm.L",
        "region": [
          1467,
          310,
          77,
          163
        ],
        "registrationFit": {
          "cost": 0.051839464882943144,
          "scale": 1,
          "dx": 0,
          "dy": -2
        },
        "changedPixels": 4454
      },
      {
        "direction": "right",
        "name": "arm.R",
        "region": [
          1727,
          310,
          78,
          160
        ],
        "registrationFit": {
          "cost": 0.04574132492113565,
          "scale": 1,
          "dx": 0,
          "dy": 0
        },
        "changedPixels": 4809
      },
      {
        "direction": "right",
        "name": "grip-fingers",
        "region": [
          1837,
          310,
          78,
          160
        ],
        "derivedFrom": "arm.R RGB at identical local UV; original overlay alpha",
        "changedPixels": 447
      },
      {
        "direction": "back",
        "name": "arm.R",
        "region": [
          762,
          530,
          121,
          145
        ],
        "registrationFit": {
          "cost": 0.036753445635528334,
          "scale": 1,
          "dx": 0,
          "dy": 0
        },
        "changedPixels": 5150
      },
      {
        "direction": "back",
        "name": "grip-fingers",
        "region": [
          915,
          530,
          121,
          145
        ],
        "derivedFrom": "arm.R RGB at identical local UV; original overlay alpha",
        "changedPixels": 506
      },
      {
        "direction": "back",
        "name": "arm.L",
        "region": [
          1576,
          310,
          119,
          160
        ],
        "registrationFit": {
          "cost": 0.0374251497005988,
          "scale": 1,
          "dx": 0,
          "dy": 0
        },
        "changedPixels": 5233
      }
    ]
  },
  {
    "group": "oblique",
    "file": "public/art/sakura-oblique-20261006/parts.webp",
    "data": "public/art/sakura-oblique-20261006/views.json",
    "sourceSha256": "b432c92fcff7dedfcb1299e8ba1cd3a1c5a551c9da2aa61b9c2f1633b87d3e98",
    "sha256": "5ca7bad71992fb2cd12b73f6dc538c5ad4d385d6487f859c102b5de8ff371553",
    "bytes": 822298,
    "geometrySha256": "1c3c778cedceeed09c1ef69a8a22ef996cf6baeeead36e6126e5a0a47a15a200",
    "alphaSha256": "f5492c33a6828a2c9d1adc4a0976b6de9167e638fc37c211cbd9b90090c08637",
    "protectedRgbaSha256": "76ef6b64a54c19befcf40c6ededbf38e054eef112dfaa8e6dcfac73089f25441",
    "maskSha256": "7b26a8c4404c442db245183735411e9c2f02690b538ade7c0ed9ef42130865e7",
    "mask": "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",
    "changedPixels": 47222,
    "parts": [
      {
        "direction": "front-right",
        "name": "arm.R",
        "region": [
          1708,
          309,
          130,
          165
        ],
        "registrationFit": {
          "cost": 0.05771643663739021,
          "scale": 1,
          "dx": 0,
          "dy": -2
        },
        "changedPixels": 5842
      },
      {
        "direction": "front-right",
        "name": "grip-fingers",
        "region": [
          1870,
          309,
          130,
          165
        ],
        "derivedFrom": "arm.R RGB at identical local UV; original overlay alpha",
        "changedPixels": 433
      },
      {
        "direction": "front-right",
        "name": "arm.L",
        "region": [
          848,
          309,
          121,
          173
        ],
        "registrationFit": {
          "cost": 0.05670103092783505,
          "scale": 1,
          "dx": 0,
          "dy": -2
        },
        "changedPixels": 5624
      },
      {
        "direction": "front-left",
        "name": "arm.R",
        "region": [
          1001,
          309,
          139,
          171
        ],
        "registrationFit": {
          "cost": 0.0661345496009122,
          "scale": 1,
          "dx": 0,
          "dy": -2
        },
        "changedPixels": 6337
      },
      {
        "direction": "front-left",
        "name": "grip-fingers",
        "region": [
          1172,
          309,
          139,
          171
        ],
        "derivedFrom": "arm.R RGB at identical local UV; original overlay alpha",
        "changedPixels": 379
      },
      {
        "direction": "front-left",
        "name": "arm.L",
        "region": [
          242,
          309,
          114,
          186
        ],
        "registrationFit": {
          "cost": 0.055229142185663924,
          "scale": 1,
          "dx": 0,
          "dy": 0
        },
        "changedPixels": 6331
      },
      {
        "direction": "back-right",
        "name": "arm.R",
        "region": [
          1169,
          527,
          121,
          145
        ],
        "registrationFit": {
          "cost": 0.04317548746518106,
          "scale": 0.96,
          "dx": 0,
          "dy": -2
        },
        "changedPixels": 5566
      },
      {
        "direction": "back-right",
        "name": "grip-fingers",
        "region": [
          1322,
          527,
          121,
          145
        ],
        "derivedFrom": "arm.R RGB at identical local UV; original overlay alpha",
        "changedPixels": 417
      },
      {
        "direction": "back-right",
        "name": "arm.L",
        "region": [
          16,
          527,
          115,
          161
        ],
        "registrationFit": {
          "cost": 0.047619047619047616,
          "scale": 1,
          "dx": 0,
          "dy": -2
        },
        "changedPixels": 5349
      },
      {
        "direction": "back-left",
        "name": "arm.R",
        "region": [
          553,
          527,
          115,
          153
        ],
        "registrationFit": {
          "cost": 0.029498525073746312,
          "scale": 1,
          "dx": 0,
          "dy": 0
        },
        "changedPixels": 5357
      },
      {
        "direction": "back-left",
        "name": "grip-fingers",
        "region": [
          700,
          527,
          115,
          153
        ],
        "derivedFrom": "arm.R RGB at identical local UV; original overlay alpha",
        "changedPixels": 493
      },
      {
        "direction": "back-left",
        "name": "arm.L",
        "region": [
          1573,
          309,
          103,
          166
        ],
        "registrationFit": {
          "cost": 0.045317220543806644,
          "scale": 1,
          "dx": 0,
          "dy": 0
        },
        "changedPixels": 5094
      }
    ]
  }
];
for(const c of candidates)test(c.group+' accepted hand/sleeve pixels preserve every alpha and non-arm pixel',async()=>{
 const file=root+'/'+c.file,data=fs.readFileSync(root+'/'+c.data),bytes=fs.readFileSync(file);
 assert.equal(sha(bytes),c.sha256);assert.equal(bytes.length,c.bytes);assert.equal(sha(data),c.geometrySha256);
 const m=await sharp(bytes).metadata();assert.equal(m.width,2048);assert.equal(m.height,1024);
 const raw=await sharp(bytes).ensureAlpha().raw().toBuffer(),mask=brotliDecompressSync(Buffer.from(c.mask,'base64'));
 assert.equal(sha(mask),c.maskSha256);assert.equal(mask.length,2048*1024);
 const alpha=Buffer.alloc(mask.length),protectedParts=[];for(let i=0;i<mask.length;i++){assert(mask[i]===0||mask[i]===1);alpha[i]=raw[i*4+3];if(!mask[i])protectedParts.push(raw.subarray(i*4,i*4+4));}
 assert.equal(sha(alpha),c.alphaSha256);assert.equal(sha(Buffer.concat(protectedParts)),c.protectedRgbaSha256);
 const views=JSON.parse(data).views;
 for(const direction of Object.keys(views)){
  const arm=views[direction].meshes.find(p=>p.name==='arm.R'),grip=views[direction].meshes.find(p=>p.name==='grip-fingers');
  assert.deepEqual(arm.paintedRegistration,grip.paintedRegistration);assert.deepEqual(arm.region.slice(2),grip.region.slice(2));
  const [ax,ay,w,h]=arm.region,[gx,gy]=grip.region;let sync=0;
  for(let y=0;y<h;y++)for(let x=0;x<w;x++){const ai=((ay+y)*2048+ax+x)*4,gi=((gy+y)*2048+gx+x)*4;if(mask[gi/4]){assert.deepEqual(raw.subarray(gi,gi+3),raw.subarray(ai,ai+3));sync++;}}
  assert(sync>0,direction+' finger foreground must use the same hand RGB, not a separate painting');
 }
 assert.equal(c.parts.filter(p=>p.name.startsWith('arm.')).length,8);assert.equal(c.parts.filter(p=>p.name==='grip-fingers').length,4);
});
