/**
 * Tests for RecordListObjectService.
 *
 * Asserts the CONTRACT the property editor depends on — every option carries a
 * label and an API name, the list is label-sorted, and system objects are absent —
 * rather than a fixed count, which would break whenever the org gains a field or a
 * package.
 */
@IsTest
private class RecordListObjectServiceTest {
    @IsTest
    static void testReturnsOptionsWithLabelsAndApiNames() {
        Test.startTest();
        List<RecordListObjectService.ObjectOption> options = RecordListObjectService.getListableObjects();
        Test.stopTest();

        Assert.isFalse(options.isEmpty(), 'Every org has queryable objects.');
        for (RecordListObjectService.ObjectOption option : options) {
            Assert.isNotNull(option.label, 'A picker entry needs a label.');
            Assert.isNotNull(option.apiName, 'A picker entry needs an API name.');
            Assert.isFalse(String.isBlank(option.label), 'Labels must not be blank.');
        }
    }

    @IsTest
    static void testIncludesCommonStandardObjects() {
        List<RecordListObjectService.ObjectOption> options = RecordListObjectService.getListableObjects();

        Set<String> apiNames = new Set<String>();
        for (RecordListObjectService.ObjectOption option : options) {
            apiNames.add(option.apiName);
        }

        Assert.isTrue(apiNames.contains('Account'), 'Account should be selectable.');
        Assert.isTrue(apiNames.contains('Contact'), 'Contact should be selectable.');
    }

    @IsTest
    static void testExcludesSystemGeneratedObjects() {
        List<RecordListObjectService.ObjectOption> options = RecordListObjectService.getListableObjects();

        for (RecordListObjectService.ObjectOption option : options) {
            Assert.isFalse(
                option.apiName.endsWith('__History'),
                'History objects are noise in a picker: ' + option.apiName
            );
            Assert.isFalse(
                option.apiName.endsWith('__Share'),
                'Share objects are noise in a picker: ' + option.apiName
            );
            Assert.isFalse(
                option.apiName.endsWith('__mdt'),
                'Custom metadata types cannot have list views: ' + option.apiName
            );
        }
    }

    @IsTest
    static void testOptionsAreSortedByLabel() {
        List<RecordListObjectService.ObjectOption> options = RecordListObjectService.getListableObjects();

        for (Integer i = 1; i < options.size(); i++) {
            Assert.isTrue(
                options[i - 1].label.compareTo(options[i].label) <= 0,
                'Options must be label-sorted: ' + options[i - 1].label + ' before ' + options[i].label
            );
        }
    }

    /**
     * A user with a restricted profile should still get a usable list, and never an
     * exception — the picker is the only way to configure the component.
     */
    @IsTest
    static void testRunsForAMinimalAccessUser() {
        Profile minimal = [SELECT Id FROM Profile WHERE Name = 'Standard User' LIMIT 1];
        User restricted = new User(
            Alias = 'rlist',
            Email = 'recordlist.test@example.invalid',
            EmailEncodingKey = 'UTF-8',
            LastName = 'Tester',
            LanguageLocaleKey = 'en_US',
            LocaleSidKey = 'en_US',
            ProfileId = minimal.Id,
            TimeZoneSidKey = 'America/New_York',
            UserName = 'recordlist.test.' + DateTime.now().getTime() + '@example.invalid'
        );

        System.runAs(restricted) {
            Test.startTest();
            List<RecordListObjectService.ObjectOption> options = RecordListObjectService.getListableObjects();
            Test.stopTest();

            Assert.isFalse(options.isEmpty(), 'A standard user can still query objects.');
        }
    }
}
