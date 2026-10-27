"""
Independent unit test suite for the gmaps_scraper package.
Run with: python test_gmaps_scraper.py
"""

import sys
import unittest

from parser import Ur, is_place_node, parse_place_node, parse_gmaps_response
from enricher import is_valid_email
from session_manager import create_session, get_session, stop_session


class TestGmapsScraper(unittest.TestCase):
    def setUp(self):
        # Construct a realistic mock Google Maps Place Node
        # [11] = title, [78] = placeId, [9][2] = lat, [9][3] = lng,
        # [39] = address, [7][0] = website, [178][0][0] = phone
        self.mock_place_node = [None] * 200
        self.mock_place_node[11] = "Smile Dental Care"
        self.mock_place_node[78] = "ChIJ_mock_smile_dental_12345"
        self.mock_place_node[9] = [None, None, 19.0760, 72.8777]
        self.mock_place_node[39] = "402 Linking Road, Bandra West, Mumbai 400050"
        self.mock_place_node[7] = ["https://smiledentalcare.example.com", "smiledentalcare.example.com"]
        self.mock_place_node[13] = ["Dentist", "Dental clinic"]
        self.mock_place_node[4] = [None, None, None, ["https://maps.google.com/review"], None, None, None, 4.8, 142]
        self.mock_place_node[178] = [[["+91 98200 12345"]]]

    def test_ur_helper(self):
        sample = ["a", ["b", ["c", "target"]]]
        self.assertEqual(Ur(sample, 1, 1, 1), "target")
        self.assertIsNone(Ur(sample, 5, 0))
        self.assertIsNone(Ur(None, 0))

    def test_is_place_node(self):
        self.assertTrue(is_place_node(self.mock_place_node))
        self.assertFalse(is_place_node(["Not", "A", "Place"]))
        self.assertFalse(is_place_node([]))

    def test_parse_place_node(self):
        parsed = parse_place_node(self.mock_place_node)
        self.assertEqual(parsed["name"], "Smile Dental Care")
        self.assertEqual(parsed["placeId"], "ChIJ_mock_smile_dental_12345")
        self.assertEqual(parsed["phone"], "+91 98200 12345")
        self.assertEqual(parsed["website"], "https://smiledentalcare.example.com")
        self.assertEqual(parsed["averageRating"], 4.8)
        self.assertEqual(parsed["reviewCount"], 142)
        self.assertEqual(parsed["latitude"], 19.0760)
        self.assertEqual(parsed["longitude"], 72.8777)
        self.assertIn("Dentist", parsed["categories"])

    def test_parse_gmaps_response_wrapper(self):
        mock_full_payload = [
            "nested_prefix",
            [
                "sub_array",
                [self.mock_place_node]
            ]
        ]
        results = parse_gmaps_response(mock_full_payload)
        self.assertEqual(len(results), 1)
        self.assertEqual(results[0]["name"], "Smile Dental Care")

    def test_email_validation(self):
        self.assertTrue(is_valid_email("info@smiledentalcare.com"))
        self.assertTrue(is_valid_email("dr.sharma+contact@gmail.com"))
        self.assertFalse(is_valid_email("icon@site.png"))  # bogus extension
        self.assertFalse(is_valid_email("sentry@sentry.io"))  # ignored domain
        self.assertFalse(is_valid_email("invalid-email-no-at"))

    def test_session_lifecycle(self):
        session = create_session(query="Dentists in Mumbai", target_count=2)
        self.assertTrue(session.is_active)
        self.assertEqual(session.target_count, 2)

        # Add first lead
        lead1 = parse_place_node(self.mock_place_node)
        added1 = session.add_leads([lead1])
        self.assertEqual(added1, 1)
        self.assertTrue(session.is_active)

        # Test duplicate prevention
        added_dup = session.add_leads([lead1])
        self.assertEqual(added_dup, 0)

        # Add second lead
        lead2 = dict(lead1)
        lead2["placeId"] = "ChIJ_second_lead_67890"
        lead2["name"] = "Apex Dental Clinic"
        added2 = session.add_leads([lead2])
        self.assertEqual(added2, 1)

        # Target count reached (2/2) -> should mark active = False
        self.assertFalse(session.is_active)
        self.assertEqual(len(session.get_leads()), 2)


if __name__ == "__main__":
    unittest.main()
