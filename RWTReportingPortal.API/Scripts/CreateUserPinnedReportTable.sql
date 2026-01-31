-- Create UserPinnedReport table for Quick Access functionality
-- Run this script on your SQL Server database

USE [RWT_Reporting_Portal]  -- Change to your database name if different
GO

IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'UserPinnedReport' AND schema_id = SCHEMA_ID('portal'))
BEGIN
    CREATE TABLE [portal].[UserPinnedReport] (
        [UserPinnedReportId] INT IDENTITY(1,1) NOT NULL,
        [UserId] INT NOT NULL,
        [ReportId] INT NOT NULL,
        [SortOrder] INT NOT NULL DEFAULT 0,
        [CreatedAt] DATETIME2(7) NOT NULL DEFAULT GETUTCDATE(),
        CONSTRAINT [PK_UserPinnedReport] PRIMARY KEY CLUSTERED ([UserPinnedReportId] ASC),
        CONSTRAINT [FK_UserPinnedReport_User] FOREIGN KEY ([UserId]) REFERENCES [portal].[User] ([UserId]) ON DELETE CASCADE,
        CONSTRAINT [FK_UserPinnedReport_Report] FOREIGN KEY ([ReportId]) REFERENCES [portal].[Report] ([ReportId]) ON DELETE CASCADE
    );

    -- Create unique index to prevent duplicate pins
    CREATE UNIQUE INDEX [IX_UserPinnedReport_UserId_ReportId]
    ON [portal].[UserPinnedReport] ([UserId], [ReportId]);

    PRINT 'UserPinnedReport table created successfully.';
END
ELSE
BEGIN
    PRINT 'UserPinnedReport table already exists.';
END
GO
