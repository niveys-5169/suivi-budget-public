"""Verify serialized XLSX text safety and ordinary exports without Firebase."""
import importlib.util
from datetime import datetime
from io import BytesIO
from pathlib import Path
import unittest
from zipfile import ZipFile
from xml.etree import ElementTree

import openpyxl

spec = importlib.util.spec_from_file_location(
    "export_transactions_xlsx",
    Path(__file__).resolve().parents[1] / "scripts" / "export_transactions_xlsx.py",
)
exporter = importlib.util.module_from_spec(spec)
spec.loader.exec_module(exporter)


class ExportSecurityTests(unittest.TestCase):
    def roundtrip(self, transactions):
        wb = exporter.build_workbook(transactions)
        exporter.add_stats_sheet(wb, transactions)
        output = BytesIO()
        wb.save(output)
        with ZipFile(output) as archive:
            for name in archive.namelist():
                if name.startswith("xl/worksheets/") and name.endswith(".xml"):
                    root = ElementTree.fromstring(archive.read(name))
                    self.assertEqual(root.findall(".//{*}f"), [], name)
        output.seek(0)
        return openpyxl.load_workbook(output, data_only=False)

    def test_external_strings_remain_literal_in_both_sheets(self):
        for payload in ("=1+1", '=HYPERLINK("https://example.invalid","x")',
                        "=SUM(A1:A2)", "=", " +1", "+1", "-1", "@SUM(A1)",
                        "\t=1+1", "\n=1+1", "#N/A", "#REF!"):
            with self.subTest(payload=payload):
                tx = {key: payload for _, key in exporter.COLUMNS}
                tx.update(montant=-12.345, pointe=True, enAttente=False)
                wb = self.roundtrip([tx])
                ws = wb["Transactions"]
                for col, (_, key) in enumerate(exporter.COLUMNS, 1):
                    if key not in ("montant", "pointe", "enAttente"):
                        self.assertEqual(ws.cell(2, col).value, payload)
                        self.assertEqual(ws.cell(2, col).data_type, "s")
                self.assertEqual(wb["Résumé"]["A2"].value, payload[:7])
                self.assertEqual(wb["Résumé"]["F2"].value, payload.strip())

    def test_legitimate_transactions_and_totals_preserved(self):
        wb = self.roundtrip([
            {"date": datetime(2026, 10, 1), "libelle": "Électricité",
             "montant": -12.345, "categorie": "Logement", "commentaire": None,
             "pointe": True, "enAttente": True},
            {"date": "2026-10-02", "montant": 100, "categorie": "Salaire"},
        ])
        ws = wb["Transactions"]
        self.assertEqual(ws["B2"].value, "2026-10-01")
        self.assertEqual(ws["C2"].value, "Électricité")
        self.assertEqual(ws["D2"].value, -12.35)
        self.assertEqual(ws["D2"].data_type, "n")
        self.assertEqual(ws["D2"].number_format, "#,##0.00")
        self.assertEqual(ws["H2"].value, "Oui")
        self.assertEqual(ws["K2"].value, "Oui")
        self.assertEqual(ws.freeze_panes, "A2")
        stats = wb["Résumé"]
        self.assertEqual([stats.cell(2, c).value for c in (2, 3, 4)],
                         [100, -12.35, 87.66])
        self.assertEqual(stats["F2"].value, "Logement")
        self.assertEqual(stats["G2"].value, -12.35)


if __name__ == "__main__":
    unittest.main()
